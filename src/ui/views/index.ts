import type { ReactNode } from 'react';
import type { DashboardView } from '../../application/queries';
import type { Route } from '../routing/routes';
import { ChallengeView } from './ChallengeView';
import { HistoryView } from './HistoryView';
import { IntegrationsView } from './IntegrationsView';
import { SettingsView } from './PlaceholderViews';
import { SetupView } from './SetupView';
import { TodayView } from './TodayView';

export const VIEWS: Record<Route, (props: { view: DashboardView }) => ReactNode> = {
  today: TodayView,
  challenge: ChallengeView,
  history: HistoryView,
  integrations: IntegrationsView,
  settings: SettingsView,
  setup: SetupView,
};
