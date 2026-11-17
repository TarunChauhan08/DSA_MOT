import type { DashboardView } from '../../application/queries';
import { DayStrip } from '../design-system/DayStrip';
import { EmptyState } from '../design-system/EmptyState';
import { GraceDots } from '../design-system/GraceDots';
import { LinkButton } from '../design-system/LinkButton';
import { Section } from '../design-system/Section';
import { formatInr, PLATFORM_LABEL } from '../format';
import { AddProblemForm } from './AddProblemForm';
import { EntryBadge } from './badges';
import { DuplicateSuggestions } from './DuplicateSuggestions';
import { TodayHero } from './TodayHero';

function Onboarding() {
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex flex-col gap-2">
        <h2 className="display-condensed text-[34px] leading-[1.05]">
          Make skipping DSA cost something.
        </h2>
        <p className="max-w-[46ch] text-sm text-muted">
          Pick a daily target and a 7, 15 or 30-day challenge. Problems from LeetCode and Striver’s
          A2Z sheet count toward one goal.
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2.5 text-sm">
        <dt className="font-medium text-accent">Full day</dt>
        <dd className="text-muted">Streak grows. Nothing to pay.</dd>
        <dt className="font-medium text-warning">Partial day</dt>
        <dd className="text-muted">A share of the day’s virtual penalty.</dd>
        <dt className="font-medium text-info">Empty day</dt>
        <dd className="text-muted">Uses a grace day while you have one.</dd>
        <dt className="font-medium text-danger">After grace</dt>
        <dd className="text-muted">Full penalty, rising each time.</dd>
      </dl>
      <div>
        <LinkButton to="setup">Set up your first challenge</LinkButton>
      </div>
    </div>
  );
}

export function TodayView({ view }: { view: DashboardView }) {
  if (!view.hasAnyChallenge) return <Onboarding />;
  const { current } = view;

  return (
    <div className="flex flex-col gap-6">
      <TodayHero view={view} />

      {current === null ? (
        <EmptyState
          title="No active challenge"
          description="Your streak keeps counting with your last target. Start a new challenge to put rupees back on the line."
          action={<LinkButton to="setup">Start a new challenge</LinkButton>}
        />
      ) : (
        <Section
          title={`${String(current.planDays)}-day challenge`}
          aside={
            <span className="text-[13px] text-muted">
              Day {current.dayNumber} of {current.planDays}
            </span>
          }
        >
          <DayStrip days={current.days} target={current.config.dailyTarget} />
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Full days</dt>
              <dd className="font-semibold">
                {current.successDays}{' '}
                <span className="font-normal text-muted">
                  of {current.requiredSuccessDays} needed
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Grace left</dt>
              <dd className="pt-1">
                <GraceDots remaining={current.graceRemaining} total={current.graceDays} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Penalty so far</dt>
              <dd
                className={`font-semibold ${current.closedPenaltyPaise > 0 ? 'text-danger' : ''}`}
              >
                {formatInr(current.closedPenaltyPaise)}
              </dd>
            </div>
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

      <DuplicateSuggestions suggestions={view.duplicateSuggestions} />

      <Section title="Add a problem">
        <AddProblemForm />
      </Section>

      <Section
        title="Solved today"
        aside={
          <span className="text-xs text-muted">
            {view.todayEntries.length === 0 ? '' : 'Manual entries are labelled'}
          </span>
        }
      >
        {view.todayEntries.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing logged yet. Solves from LeetCode and ticks on the Striver sheet appear here.
          </p>
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
