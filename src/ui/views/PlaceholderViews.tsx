import { DEFAULT_TIME_ZONE } from '../../domain/calendar';
import { EmptyState } from '../design-system/EmptyState';

export function IntegrationsView() {
  return (
    <EmptyState
      title="Integrations not connected yet"
      description="Automatic LeetCode (by username) and Striver A2Z tracking arrive in the next build. Until then, add problems by hand on the Today tab — they are labelled as manual."
    />
  );
}

export function SettingsView() {
  return (
    <EmptyState
      title="Settings"
      description={`Days run midnight to midnight in ${DEFAULT_TIME_ZONE}. Theme, reminders and backup settings arrive in a later build.`}
    />
  );
}
