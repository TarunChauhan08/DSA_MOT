import { DEFAULT_TIME_ZONE } from '../../domain/calendar';
import { EmptyState } from '../design-system/EmptyState';

export function SettingsView() {
  return (
    <EmptyState
      title="Settings"
      description={`Days run midnight to midnight in ${DEFAULT_TIME_ZONE}. Theme, reminders and backup settings arrive in a later build.`}
    />
  );
}
