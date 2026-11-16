import type { Clock, IdGenerator } from '../../src/application/ports';
import type { Deps } from '../../src/application/useCases';
import type { ChallengeConfig } from '../../src/domain/challenge/config';
import { paise } from '../../src/domain/money';
import { DsaDatabase } from '../../src/persistence/db';

export class FakeClock implements Clock {
  constructor(private ms: number) {}
  now(): number {
    return this.ms;
  }
  /** Sets the clock to an IST wall-clock time, e.g. at('2026-11-16T10:00'). */
  at(istLocal: string): this {
    this.ms = Date.parse(`${istLocal}:00+05:30`);
    return this;
  }
}

export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { next: () => `${prefix}-${String((n += 1))}` };
}

let dbCounter = 0;
export function makeDeps(startIst = '2026-11-16T10:00'): Deps & { clock: FakeClock } {
  dbCounter += 1;
  const db = new DsaDatabase(`test-db-${String(dbCounter)}-${String(Math.random())}`);
  return { db, clock: new FakeClock(0).at(startIst), ids: sequentialIds() };
}

export function config(overrides: Partial<ChallengeConfig> = {}): ChallengeConfig {
  return {
    planDays: 7,
    dailyTarget: 4,
    startPenaltyPaise: paise(2000),
    incrementPaise: paise(2000),
    timeZone: 'Asia/Kolkata',
    countManual: true,
    ...overrides,
  };
}

/** IST wall-clock → epoch ms. */
export const ist = (local: string) => Date.parse(`${local}:00+05:30`);
