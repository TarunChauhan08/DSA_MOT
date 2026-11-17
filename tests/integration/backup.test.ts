import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  exportBackup,
  importBackup,
  parseBackup,
  resetAllData,
} from '../../src/application/backup';
import { loadDashboard } from '../../src/application/queries';
import { finalizeDueDays, recordCompletion, startChallenge } from '../../src/application/useCases';
import { LATEST_SCHEMA_VERSION } from '../../src/persistence/schema';
import { config, makeDeps } from './helpers';

type D = ReturnType<typeof makeDeps>;

async function populated(): Promise<D> {
  const deps = makeDeps('2026-11-16T09:00');
  await startChallenge(deps, config());
  for (const [i, n] of [4, 3, 0].entries()) {
    deps.clock.at(`2026-11-${String(16 + i)}T12:00`);
    for (let k = 0; k < n; k += 1) {
      await recordCompletion(deps, {
        evidence: 'USER_MANUAL',
        platform: 'leetcode',
        slug: `p${String(i)}-${String(k)}`,
        title: 'P',
      });
    }
  }
  deps.clock.at('2026-11-19T10:00');
  await finalizeDueDays(deps);
  return deps;
}

describe('exportBackup / parseBackup', () => {
  it('produces a versioned, checksummed backup that round-trips', async () => {
    const deps = await populated();
    const { json, checksum } = await exportBackup(deps.db, deps.clock.now(), '1.0.0');
    const parsed = await parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup).toMatchObject({
      format: BACKUP_FORMAT,
      schemaVersion: LATEST_SCHEMA_VERSION,
      checksum,
      appVersion: '1.0.0',
    });
    expect(parsed.backup.data.completions).toHaveLength(7);
    expect(parsed.backup.data.challenges).toHaveLength(1);
  });

  it.each([
    ['not json at all', 'Not a valid backup file (not JSON).'],
    [JSON.stringify({ hello: 'world' }), 'This file is not a DSA Discipline backup.'],
  ])('rejects %s', async (text, reason) => {
    expect(await parseBackup(text)).toEqual({ ok: false, reason });
  });

  it('detects tampering or corruption through the checksum', async () => {
    const deps = await populated();
    const { json } = await exportBackup(deps.db, deps.clock.now(), '1.0.0');
    const tampered = json.replace('"title":"P"', '"title":"Q"');
    expect(await parseBackup(tampered)).toEqual({
      ok: false,
      reason: 'The backup is damaged: its checksum does not match.',
    });
  });

  it('refuses backups from a newer version of the extension', async () => {
    const deps = await populated();
    const { json } = await exportBackup(deps.db, deps.clock.now(), '1.0.0');
    const newer = JSON.stringify({
      ...(JSON.parse(json) as object),
      schemaVersion: LATEST_SCHEMA_VERSION + 1,
    });
    expect(await parseBackup(newer)).toMatchObject({
      ok: false,
      reason: 'This backup was made by a newer version. Update the extension first.',
    });
  });

  it('rejects invalid records even with a matching structure', async () => {
    const deps = await populated();
    const { json } = await exportBackup(deps.db, deps.clock.now(), '1.0.0');
    const obj = JSON.parse(json) as {
      schemaVersion: number;
      data: { completions: Array<Record<string, unknown>> };
    };
    const first = obj.data.completions[0];
    if (first) first.sourceKey = '<script>';
    const { recomputeChecksum } = await import('../../src/application/backup');
    const resigned = await recomputeChecksum(obj);
    expect(await parseBackup(JSON.stringify(resigned))).toMatchObject({ ok: false });
  });
});

describe('importBackup', () => {
  it('restores everything into an empty install and recomputes', async () => {
    const source = await populated();
    const { json } = await exportBackup(source.db, source.clock.now(), '1.0.0');
    const before = await loadDashboard(source.db, source.clock.now());

    const target = makeDeps('2026-11-19T10:00');
    const parsed = await parseBackup(json);
    if (!parsed.ok) throw new Error(parsed.reason);
    const result = await importBackup(target.db, parsed.backup, target.clock.now());
    expect(result).toEqual({ ok: true, completions: 7, challenges: 1 });

    const after = await loadDashboard(target.db, target.clock.now());
    expect(after.current?.days.map((d) => d.outcome)).toEqual(
      before.current?.days.map((d) => d.outcome),
    );
    expect(after.penalty).toEqual(before.penalty);
  });

  it('detects a backup identical to the current data (duplicate import)', async () => {
    const deps = await populated();
    const { json } = await exportBackup(deps.db, deps.clock.now(), '1.0.0');
    const parsed = await parseBackup(json);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(await importBackup(deps.db, parsed.backup, deps.clock.now())).toEqual({
      ok: false,
      reason: 'DUPLICATE',
    });
  });

  it('imports an older (v1) backup by migrating it', async () => {
    const source = await populated();
    const { json } = await exportBackup(source.db, source.clock.now(), '0.4.0');
    const v1 = JSON.parse(json) as { schemaVersion: number; data: Record<string, unknown> };
    v1.schemaVersion = 1;
    delete v1.data.notificationLog;
    const { recomputeChecksum } = await import('../../src/application/backup');
    const parsed = await parseBackup(JSON.stringify(await recomputeChecksum(v1)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const target = makeDeps('2026-11-19T10:00');
    expect(await importBackup(target.db, parsed.backup, target.clock.now())).toMatchObject({
      ok: true,
    });
    expect(await target.db.notificationLog.count()).toBe(0);
  });
});

describe('resetAllData', () => {
  it('deletes every record', async () => {
    const deps = await populated();
    await resetAllData(deps.db);
    for (const table of deps.db.tables) expect(await table.count()).toBe(0);
  });
});
