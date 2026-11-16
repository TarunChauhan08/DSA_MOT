import { useId, useState, type SyntheticEvent } from 'react';
import type { DashboardView } from '../../application/queries';
import type { Health } from '../../application/integrationState';
import { describeFailure, sendCommand } from '../../messaging/client';
import { Badge, type BadgeTone } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Section } from '../design-system/Section';
import { Stat } from '../design-system/Stat';
import { formatAgo } from '../format';

function healthBadge(health: Health): { tone: BadgeTone; label: string } {
  if (health.lastError !== null) return { tone: 'danger', label: 'Needs attention' };
  if (health.lastSuccessAtMs !== null) return { tone: 'accent', label: 'Active' };
  return { tone: 'muted', label: 'Waiting for first check' };
}

function ConnectLeetCode() {
  const id = useId();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    const result = await sendCommand({ type: 'CONNECT_LEETCODE', username }).finally(() => {
      setPending(false);
    });
    setError(result.ok ? null : describeFailure(result));
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor={id} className="text-sm font-medium">
        LeetCode username
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="your-username"
          aria-invalid={error !== null}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <Button type="submit" disabled={pending || username.trim() === ''}>
          {pending ? 'Checking…' : 'Connect'}
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function LeetCodeSection({ view }: { view: DashboardView }) {
  const { username, health, stats } = view.integrations.leetcode;
  const [message, setMessage] = useState<string | null>(null);
  const badge = healthBadge(health);

  const run = async (type: 'REFRESH_INTEGRATIONS' | 'DISCONNECT_LEETCODE') => {
    const result = await sendCommand({ type });
    if (!result.ok) setMessage(describeFailure(result));
    else if (result.detail === 'skipped')
      setMessage('Checked moments ago — try again in a couple of minutes.');
    else setMessage(null);
  };

  return (
    <Section
      title="LeetCode"
      aside={
        username === null ? (
          <Badge tone="muted">Not connected</Badge>
        ) : (
          <Badge tone={badge.tone}>{badge.label}</Badge>
        )
      }
    >
      {username === null ? (
        <ConnectLeetCode />
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">Username</dt>
            <dd className="font-medium">{username}</dd>
            <dt className="text-muted">Last checked</dt>
            <dd>
              {health.lastSuccessAtMs === null
                ? 'Not yet'
                : formatAgo(view.nowMs, health.lastSuccessAtMs)}
            </dd>
            <dt className="text-muted">Last new solve</dt>
            <dd>
              {health.lastNewSolveAtMs === null
                ? 'None found yet'
                : formatAgo(view.nowMs, health.lastNewSolveAtMs)}
            </dd>
          </dl>
          {health.lastError !== null && (
            <p
              role="status"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
            >
              {health.lastError}
            </p>
          )}
          {stats !== null && (
            <dl className="grid grid-cols-4 gap-3 rounded-lg border border-border px-3 py-2.5">
              <Stat label="Solved" value={stats.all} />
              <Stat label="Easy" value={<span className="text-accent">{stats.easy}</span>} />
              <Stat label="Medium" value={<span className="text-warning">{stats.medium}</span>} />
              <Stat label="Hard" value={<span className="text-danger">{stats.hard}</span>} />
            </dl>
          )}
          <div className="flex gap-2">
            <Button onClick={() => void run('REFRESH_INTEGRATIONS')}>Check now</Button>
            <Button variant="ghost" onClick={() => void run('DISCONNECT_LEETCODE')}>
              Disconnect
            </Button>
          </div>
          {message !== null && (
            <p role="status" className="text-sm text-muted">
              {message}
            </p>
          )}
        </div>
      )}
      <details className="text-sm text-muted">
        <summary className="cursor-pointer text-text">How LeetCode tracking works</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>Uses only your public profile — no password, no login, no cookies.</li>
          <li>
            Checks your recent accepted submissions about every 30 minutes while Chrome is running,
            and when you open the popup.
          </li>
          <li>Solves count on the day LeetCode recorded them (India time), even if found later.</li>
          <li>
            LeetCode lists only your ~10 latest accepted solves. If you solve more than that within
            half an hour, open the popup in between.
          </li>
          <li>The stats card refreshes at most every 6 hours and never affects your target.</li>
        </ul>
      </details>
    </Section>
  );
}

function StriverSection({ view }: { view: DashboardView }) {
  const { health } = view.integrations.tuf;
  return (
    <Section
      title="Striver A2Z (takeUforward)"
      aside={
        health.lastNewSolveAtMs === null ? (
          <Badge tone="muted">No ticks seen yet</Badge>
        ) : (
          <Badge tone="accent">Active</Badge>
        )
      }
    >
      <p className="text-sm">
        {health.lastNewSolveAtMs === null
          ? 'Tick a problem on the A2Z sheet while signed in to takeUforward and it appears here.'
          : `Last tick detected ${formatAgo(view.nowMs, health.lastNewSolveAtMs)}.`}
      </p>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer text-text">How Striver tracking works</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>
            Ticking a problem on the sheet counts as “Sheet marked” — it is not shown as an accepted
            submission.
          </li>
          <li>
            Ticks are noticed only while the sheet is open in Chrome; problems ticked earlier or
            elsewhere are not imported.
          </li>
          <li>Theory lessons on the sheet are ignored; only practice problems count.</li>
          <li>
            If takeUforward changes its page and ticks stop appearing, add problems manually on the
            Today tab.
          </li>
        </ul>
      </details>
    </Section>
  );
}

export function IntegrationsView({ view }: { view: DashboardView }) {
  return (
    <div className="flex flex-col gap-5">
      <LeetCodeSection view={view} />
      <StriverSection view={view} />
    </div>
  );
}
