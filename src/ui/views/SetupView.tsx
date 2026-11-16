import { useId, useState } from 'react';
import type { DashboardView } from '../../application/queries';
import { DEFAULT_TIME_ZONE } from '../../domain/calendar';
import {
  MAX_DAILY_TARGET,
  PLAN_DAYS,
  PLAN_RULES,
  type PlanDays,
} from '../../domain/challenge/config';
import { describeFailure, sendCommand } from '../../messaging/client';
import { StartChallengeInputSchema, type StartChallengeInput } from '../../messaging/contracts';
import { Button } from '../design-system/Button';
import { EmptyState } from '../design-system/EmptyState';
import { LinkButton } from '../design-system/LinkButton';
import { Section } from '../design-system/Section';
import { routeHref } from '../routing/routes';

const DEFAULTS = { dailyTarget: '3', startPenaltyRupees: '20', incrementRupees: '20' };
const MAX_RUPEES = 100_000;

interface Draft {
  planDays: PlanDays;
  dailyTarget: string;
  startPenaltyRupees: string;
  incrementRupees: string;
  countManual: boolean;
}

function toInput(d: Draft): StartChallengeInput | null {
  const parsed = StartChallengeInputSchema.safeParse({
    planDays: d.planDays,
    dailyTarget: Number(d.dailyTarget),
    startPenaltyRupees: Number(d.startPenaltyRupees),
    incrementRupees: Number(d.incrementRupees),
    countManual: d.countManual,
  });
  return parsed.success ? parsed.data : null;
}

function NumberField(props: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  invalid: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {props.label}
      </label>
      <div className="flex h-9 items-center rounded-lg border border-border bg-surface px-3 focus-within:outline-2 focus-within:outline-[var(--focus)]">
        {props.prefix !== undefined && (
          <span className="mr-1 text-sm text-muted">{props.prefix}</span>
        )}
        <input
          id={id}
          inputMode="numeric"
          value={props.value}
          onChange={(e) => {
            props.onChange(e.target.value.replace(/[^\d]/g, ''));
          }}
          aria-invalid={props.invalid}
          className="w-full bg-transparent text-sm tabular-nums outline-none"
        />
      </div>
      <p className={`text-xs ${props.invalid ? 'text-danger' : 'text-muted'}`}>{props.hint}</p>
    </div>
  );
}

function Summary({ input }: { input: StartChallengeInput }) {
  const rule = PLAN_RULES[input.planDays];
  return (
    <p className="text-sm leading-relaxed">
      Solve at least <strong>{input.dailyTarget}</strong> problems every day for{' '}
      <strong>{input.planDays} days</strong>. You need <strong>{rule.requiredSuccessDays}</strong>{' '}
      full days to pass. Up to <strong>{rule.graceDays}</strong> empty days are covered by grace. A
      penalized day costs a virtual <strong>₹{input.startPenaltyRupees}</strong> at first, rising by{' '}
      <strong>₹{input.incrementRupees}</strong> each time (partial days pay a proportional share).
    </p>
  );
}

export function SetupView({ view }: { view: DashboardView }) {
  const [draft, setDraft] = useState<Draft>({ planDays: 7, countManual: true, ...DEFAULTS });
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (view.current !== null) {
    return (
      <EmptyState
        title="A challenge is already running"
        description={`Your ${String(view.current.planDays)}-day challenge is on day ${String(view.current.dayNumber)}. Settings are locked until it ends.`}
        action={<LinkButton to="challenge">View challenge</LinkButton>}
      />
    );
  }

  const input = toInput(draft);
  const target = Number(draft.dailyTarget);
  const targetInvalid = !Number.isInteger(target) || target < 1 || target > MAX_DAILY_TARGET;
  const rupeesInvalid = (v: string) => v === '' || Number(v) > MAX_RUPEES;

  if (step === 'confirm' && input !== null) {
    const rule = PLAN_RULES[input.planDays];
    const start = async () => {
      setPending(true);
      const result = await sendCommand({ type: 'START_CHALLENGE', input }).finally(() => {
        setPending(false);
      });
      if (!result.ok) {
        setError(describeFailure(result));
        return;
      }
      window.location.hash = routeHref('today');
    };
    return (
      <div className="flex flex-col gap-5">
        <Section title="Confirm your challenge">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">Plan</dt>
            <dd>{input.planDays} days, starting today</dd>
            <dt className="text-muted">Daily target</dt>
            <dd>{input.dailyTarget} problems</dd>
            <dt className="text-muted">To pass</dt>
            <dd>{rule.requiredSuccessDays} full days</dd>
            <dt className="text-muted">Grace days</dt>
            <dd>{rule.graceDays} (empty days only)</dd>
            <dt className="text-muted">Penalty</dt>
            <dd>
              ₹{input.startPenaltyRupees}, +₹{input.incrementRupees} per penalized day
            </dd>
            <dt className="text-muted">Manual entries</dt>
            <dd>{input.countManual ? 'Count toward the target' : 'Shown, but not counted'}</dd>
            <dt className="text-muted">Time zone</dt>
            <dd>{DEFAULT_TIME_ZONE} (days run midnight to midnight)</dd>
          </dl>
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            Once started, these settings are locked and the challenge cannot be quit.
          </p>
          {error !== null && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setStep('edit');
              }}
            >
              Back
            </Button>
            <Button disabled={pending} onClick={() => void start()}>
              Start challenge
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (input !== null) setStep('confirm');
      }}
    >
      <Section title="Plan">
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="sr-only">Challenge length</legend>
          {PLAN_DAYS.map((days) => (
            <label key={days} className="cursor-pointer">
              <input
                type="radio"
                name="plan"
                className="peer sr-only"
                checked={draft.planDays === days}
                onChange={() => {
                  setDraft({ ...draft, planDays: days });
                }}
              />
              <span className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2.5 transition-colors peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]">
                <span className="text-sm font-semibold">{days} days</span>
                <span className="text-xs text-muted">
                  {PLAN_RULES[days].requiredSuccessDays} to pass · {PLAN_RULES[days].graceDays}{' '}
                  grace
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </Section>

      <Section title="Rules">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField
            label="Daily target"
            hint={`Problems per day, 1–${String(MAX_DAILY_TARGET)}`}
            value={draft.dailyTarget}
            invalid={targetInvalid}
            onChange={(v) => {
              setDraft({ ...draft, dailyTarget: v });
            }}
          />
          <NumberField
            label="Starting penalty"
            prefix="₹"
            hint="First penalized day"
            value={draft.startPenaltyRupees}
            invalid={rupeesInvalid(draft.startPenaltyRupees)}
            onChange={(v) => {
              setDraft({ ...draft, startPenaltyRupees: v });
            }}
          />
          <NumberField
            label="Increase"
            prefix="₹"
            hint="Added each penalized day"
            value={draft.incrementRupees}
            invalid={rupeesInvalid(draft.incrementRupees)}
            onChange={(v) => {
              setDraft({ ...draft, incrementRupees: v });
            }}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--accent)]"
            checked={draft.countManual}
            onChange={(e) => {
              setDraft({ ...draft, countManual: e.target.checked });
            }}
          />
          <span>
            Count manual entries and Striver sheet ticks
            <span className="block text-xs text-muted">
              They are always labelled; turn off to count only verified solves.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Summary">
        {input === null ? (
          <p className="text-sm text-danger">Fix the highlighted fields to continue.</p>
        ) : (
          <Summary input={input} />
        )}
        <p className="text-xs text-muted">Time zone: {DEFAULT_TIME_ZONE}. Day 1 is today.</p>
        <div>
          <Button type="submit" disabled={input === null}>
            Review challenge
          </Button>
        </div>
      </Section>
    </form>
  );
}
