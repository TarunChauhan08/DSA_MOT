import { describe, expect, it } from 'vitest';
import { handleCommand, type RouterContext } from '../../src/background/router';
import { nextMidnightMs } from '../../src/background/scheduler';
import { DsaDatabase } from '../../src/persistence/db';
import { ist } from './helpers';

const EXT_ID = 'abcdefghijklmnop';
const ORIGIN = `chrome-extension://${EXT_ID}/`;
const page = { id: EXT_ID, url: `${ORIGIN}sidepanel.html#/setup` };

function ctx(testClockEnabled = false): RouterContext {
  return {
    db: new DsaDatabase(`router-${String(Math.random())}`),
    extensionId: EXT_ID,
    extensionOrigin: ORIGIN,
    testClockEnabled,
  };
}

const start = {
  type: 'START_CHALLENGE',
  input: {
    planDays: 7,
    dailyTarget: 4,
    startPenaltyRupees: 20,
    incrementRupees: 20,
    countManual: true,
  },
};

describe('handleCommand', () => {
  it('starts a challenge in Asia/Kolkata with rupees converted to paise', async () => {
    const c = ctx();
    expect(await handleCommand(c, start, page)).toMatchObject({ ok: true });
    const [challenge] = await c.db.challenges.toArray();
    expect(challenge?.config).toEqual({
      planDays: 7,
      dailyTarget: 4,
      startPenaltyPaise: 2000,
      incrementPaise: 2000,
      timeZone: 'Asia/Kolkata',
      countManual: true,
    });
  });

  it('blocks a second active challenge', async () => {
    const c = ctx();
    await handleCommand(c, start, page);
    expect(await handleCommand(c, start, page)).toEqual({
      ok: false,
      error: 'ACTIVE_CHALLENGE_EXISTS',
    });
  });

  it('has no way to edit or quit a challenge', async () => {
    const c = ctx();
    await handleCommand(c, start, page);
    for (const type of [
      'UPDATE_CHALLENGE',
      'EDIT_CHALLENGE',
      'QUIT_CHALLENGE',
      'DELETE_CHALLENGE',
    ]) {
      expect(await handleCommand(c, { type, id: 'x', input: start.input }, page)).toMatchObject({
        ok: false,
        error: 'INVALID_COMMAND',
      });
    }
    expect(await c.db.challenges.count()).toBe(1);
  });

  it.each([
    [{ id: 'other-extension', url: `${ORIGIN}popup.html` }],
    [{ id: EXT_ID, url: 'https://leetcode.com/problems/two-sum/' }],
    [{ id: EXT_ID }],
    [{}],
  ])('rejects commands from %j', async (sender) => {
    const c = ctx();
    expect(await handleCommand(c, start, sender)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await c.db.challenges.count()).toBe(0);
  });

  it.each([
    [{ ...start, input: { ...start.input, planDays: 10 } }],
    [{ ...start, input: { ...start.input, dailyTarget: 0 } }],
    [{ ...start, input: { ...start.input, startPenaltyRupees: 2.5 } }],
    [{ ...start, input: { ...start.input, timeZone: 'UTC' } }],
    [{ ...start, extra: true }],
    ['START_CHALLENGE'],
  ])('rejects malformed command %j', async (raw) => {
    const c = ctx();
    expect(await handleCommand(c, raw, page)).toMatchObject({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });

  it('adds a manual problem', async () => {
    const c = ctx();
    const r = await handleCommand(
      c,
      { type: 'ADD_MANUAL_PROBLEM', platform: 'leetcode', slug: 'two-sum', title: 'Two Sum' },
      page,
    );
    expect(r).toMatchObject({ ok: true });
    expect((await c.db.completions.toArray())[0]).toMatchObject({
      sourceKey: 'lc:two-sum',
      evidence: 'USER_MANUAL',
    });
  });

  it('refuses the test clock outside the e2e build', async () => {
    const c = ctx(false);
    expect(await handleCommand(c, { type: 'TEST_SET_CLOCK', nowMs: 0 }, page)).toEqual({
      ok: false,
      error: 'FORBIDDEN',
    });
    expect(await c.db.meta.count()).toBe(0);
  });

  it('moves the clock and finalizes in the e2e build', async () => {
    const c = ctx(true);
    await handleCommand(c, start, page);
    const [challenge] = await c.db.challenges.toArray();
    const dayAfter =
      Date.parse(`${challenge?.startDay ?? ''}T00:00:00+05:30`) + 86_400_000 + 60_000;
    expect(await handleCommand(c, { type: 'TEST_SET_CLOCK', nowMs: dayAfter }, page)).toEqual({
      ok: true,
    });
    expect(await c.db.challengeDays.count()).toBe(1);
  });
});

describe('nextMidnightMs', () => {
  it('fires just after the next Kolkata midnight', () => {
    expect(nextMidnightMs(ist('2026-11-16T23:59'))).toBe(ist('2026-11-17T00:00') + 5_000);
    expect(nextMidnightMs(ist('2026-11-17T00:00'))).toBe(ist('2026-11-18T00:00') + 5_000);
  });
});
