import type { DashboardView } from '../../application/queries';
import { EmptyState } from '../design-system/EmptyState';
import { LinkButton } from '../design-system/LinkButton';
import { ProgressBar } from '../design-system/ProgressBar';
import { Section } from '../design-system/Section';
import { Stat } from '../design-system/Stat';
import { formatDay, formatInr, PLATFORM_LABEL, plural } from '../format';
import { AddProblemForm } from './AddProblemForm';
import { EntryBadge } from './badges';
import { penaltyHint } from './penaltyHint';

function Onboarding() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold tracking-tight">Make skipping DSA expensive.</h2>
        <p className="text-sm text-muted">
          Pick a daily target and a 7, 15 or 30-day challenge. Problems from LeetCode and Striver’s
          A2Z sheet count toward one goal.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <span className="font-medium">Full days</span>{' '}
          <span className="text-muted">grow your streak and cost nothing.</span>
        </li>
        <li>
          <span className="font-medium">Partial days</span>{' '}
          <span className="text-muted">cost a proportional virtual penalty.</span>
        </li>
        <li>
          <span className="font-medium">Empty days</span>{' '}
          <span className="text-muted">use a grace day — until grace runs out.</span>
        </li>
      </ul>
      <div>
        <LinkButton to="setup">Set up your first challenge</LinkButton>
      </div>
    </div>
  );
}

export function TodayView({ view }: { view: DashboardView }) {
  if (!view.hasAnyChallenge) return <Onboarding />;
  const { current } = view;
  const target = view.todayTarget;

  return (
    <div className="flex flex-col gap-5">
      <Section title={`Today · ${formatDay(view.today)}`}>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums" aria-label="Solved today">
            {view.todaySolved}
            <span className="text-lg font-normal text-muted"> / {target ?? '—'}</span>
          </p>
          <p className="text-right text-sm text-muted">
            {view.streak.current > 0
              ? `${plural(view.streak.current, 'day')} streak`
              : 'No streak yet'}
          </p>
        </div>
        {target !== null && (
          <ProgressBar value={view.todaySolved} max={target} label="Today's progress" />
        )}
        {current !== null && <p className="text-sm">{penaltyHint(current.projectedToday)}</p>}
      </Section>

      {current === null ? (
        <EmptyState
          title="No active challenge"
          description="Your streak keeps counting with your last target. Start a new challenge to put penalties back on the line."
          action={<LinkButton to="setup">Start a new challenge</LinkButton>}
        />
      ) : (
        <Section title={`${String(current.planDays)}-day challenge`}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Stat
              label="Day"
              value={`${String(current.dayNumber)} of ${String(current.planDays)}`}
            />
            <Stat
              label="Full days"
              value={`${String(current.successDays)} / ${String(current.requiredSuccessDays)}`}
              hint="needed to pass"
            />
            <Stat
              label="Grace left"
              value={`${String(current.graceRemaining)} / ${String(current.graceDays)}`}
            />
            <Stat
              label="Virtual penalty"
              value={formatInr(current.closedPenaltyPaise)}
              hint="so far"
            />
          </dl>
          {!current.canStillPass && (
            <p
              role="status"
              className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
            >
              This challenge can no longer pass. Every remaining day still counts toward your streak
              and virtual penalty.
            </p>
          )}
        </Section>
      )}

      <Section title="Add a problem">
        <AddProblemForm />
      </Section>

      <Section
        title="Solved today"
        aside={<span className="text-xs text-muted">Manual entries are labelled</span>}
      >
        {view.todayEntries.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged today yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {view.todayEntries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {e.title}
                  </a>
                  <span className="text-xs text-muted">{PLATFORM_LABEL[e.platform]}</span>
                </div>
                <EntryBadge evidence={e.evidence} status={e.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
