import type { DsaDatabase } from '../persistence/db';

export const TEST_CLOCK_META_KEY = 'testClockOffsetMs';

/**
 * Current time for the extension. In the e2e test build only, an offset stored in
 * IndexedDB shifts the clock so tests can cross midnight; production ignores it.
 */
export async function currentTimeMs(db: DsaDatabase, testClockEnabled: boolean): Promise<number> {
  const real = Date.now();
  if (!testClockEnabled) return real;
  const offset = (await db.meta.get(TEST_CLOCK_META_KEY))?.value;
  return real + (typeof offset === 'number' ? offset : 0);
}

export async function setTestClock(db: DsaDatabase, nowMs: number): Promise<void> {
  await db.meta.put({ key: TEST_CLOCK_META_KEY, value: nowMs - Date.now() });
}
