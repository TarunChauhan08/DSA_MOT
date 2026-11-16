import { META_KEYS, readHealth } from './integrationState';
import { recordCompletion, type Deps, type RecordCompletionResult } from './useCases';

/** A tick on the Striver sheet (owner decision Q7): counts as "Sheet marked", never "Accepted". */
export async function recordSheetTick(
  deps: Deps,
  problem: { readonly slug: string; readonly title: string },
): Promise<RecordCompletionResult> {
  const result = await recordCompletion(deps, {
    evidence: 'TUF_SHEET_CHECKBOX',
    slug: problem.slug,
    title: problem.title,
  });
  if (result.status === 'recorded') {
    const now = deps.clock.now();
    const health = await readHealth(deps.db, META_KEYS.tufHealth);
    await deps.db.meta.put({
      key: META_KEYS.tufHealth,
      value: { ...health, lastSuccessAtMs: now, lastNewSolveAtMs: now, lastError: null },
    });
  }
  return result;
}

/** The sheet was opened with the detector running (shown as "last seen" on Integrations). */
export async function noteSheetOpened(deps: Deps): Promise<void> {
  const health = await readHealth(deps.db, META_KEYS.tufHealth);
  await deps.db.meta.put({
    key: META_KEYS.tufHealth,
    value: { ...health, lastAttemptAtMs: deps.clock.now() },
  });
}
