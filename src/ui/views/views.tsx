import type { ReactNode } from 'react';
import { EmptyState } from '../design-system/EmptyState';
import { routeHref, type Route } from '../routing/routes';

// Phase 1 shells. Every view shows an honest empty state; no metric is shown
// until it is computed from stored data (docs/PRD.md §12).

function LinkButton({ to, children }: { to: Route; children: ReactNode }) {
  return (
    <a
      href={routeHref(to)}
      className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
    >
      {children}
    </a>
  );
}

export function TodayView() {
  return (
    <EmptyState
      title="No active challenge"
      description="Start a 7, 15 or 30-day challenge to set your daily target. Solves from LeetCode and Striver A2Z will count toward one unified goal."
      action={<LinkButton to="setup">Set up a challenge</LinkButton>}
    />
  );
}

export function ChallengeView() {
  return (
    <EmptyState
      title="No challenge yet"
      description="Your current and past challenges will appear here once you start one."
      action={<LinkButton to="setup">Set up a challenge</LinkButton>}
    />
  );
}

export function HistoryView() {
  return (
    <EmptyState
      title="No history yet"
      description="Your calendar heatmap, solved problems and virtual penalty ledger build up as you practise."
    />
  );
}

export function IntegrationsView() {
  return (
    <EmptyState
      title="Integrations not connected"
      description="LeetCode (by username) and Striver A2Z tracking are not available in this build yet. You will be able to connect them from here."
    />
  );
}

export function SettingsView() {
  return (
    <EmptyState
      title="Settings"
      description="Theme, reminders, manual-completion and backup settings are not available in this build yet."
    />
  );
}

export function SetupView() {
  return (
    <EmptyState
      title="Challenge setup"
      description="Choosing a plan, daily target and penalty rules is not available in this build yet."
    />
  );
}

export const VIEWS: Record<Route, () => ReactNode> = {
  today: TodayView,
  challenge: ChallengeView,
  history: HistoryView,
  integrations: IntegrationsView,
  settings: SettingsView,
  setup: SetupView,
};
