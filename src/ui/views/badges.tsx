import type { DayOutcome } from '../../domain/challenge/evaluate';
import type { EntryStatus, Evidence } from '../../domain/completion/counting';
import type { ChallengeStatus } from '../../persistence/records';
import { Badge, type BadgeTone } from '../design-system/Badge';
import { entryLabel, OUTCOME_LABEL } from '../format';

const OUTCOME_TONE: Record<DayOutcome, BadgeTone> = {
  SUCCESS: 'accent',
  PARTIAL_PENALIZED: 'warning',
  ZERO_GRACE: 'info',
  ZERO_PENALIZED: 'danger',
};

export function OutcomeBadge({ outcome }: { outcome: DayOutcome }) {
  return <Badge tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>;
}

export function EntryBadge({ evidence, status }: { evidence: Evidence; status: EntryStatus }) {
  const tone: BadgeTone =
    status !== 'COUNTED'
      ? 'muted'
      : evidence === 'LC_RECENT_AC' || evidence === 'TUF_SUBMISSION_ACCEPTED'
        ? 'accent'
        : evidence === 'TUF_SHEET_CHECKBOX'
          ? 'violet'
          : 'info';
  return <Badge tone={tone}>{entryLabel(evidence, status)}</Badge>;
}

const STATUS: Record<ChallengeStatus, { tone: BadgeTone; label: string }> = {
  ACTIVE: { tone: 'info', label: 'In progress' },
  PASSED: { tone: 'accent', label: 'Passed' },
  FAILED: { tone: 'danger', label: 'Failed' },
};

export function StatusBadge({ status }: { status: ChallengeStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}
