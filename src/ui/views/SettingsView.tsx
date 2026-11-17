import { useState } from 'react';
import type { DashboardView } from '../../application/queries';
import type { Settings } from '../../application/settings';
import { DEFAULT_TIME_ZONE } from '../../domain/calendar';
import { describeFailure, sendCommand } from '../../messaging/client';
import { Button } from '../design-system/Button';
import { Section } from '../design-system/Section';
import { Segmented } from '../design-system/Segmented';
import { Toggle } from '../design-system/Toggle';

const DEADLINE_OPTIONS = [0, 30, 60, 120] as const;

export function SettingsView({ view }: { view: DashboardView }) {
  const [draft, setDraft] = useState<Settings>(view.settings);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  // Reset the form only when the *saved* settings change, not on every data refresh
  // (a background LeetCode sync must not wipe unsaved edits).
  const savedKey = JSON.stringify(view.settings);
  const [baselineKey, setBaselineKey] = useState(savedKey);
  if (savedKey !== baselineKey) {
    setBaselineKey(savedKey);
    setDraft(view.settings);
  }
  const n = draft.notifications;
  const setN = (patch: Partial<Settings['notifications']>) => {
    setDraft({ ...draft, notifications: { ...n, ...patch } });
    setStatus(null);
  };

  const save = async () => {
    const result = await sendCommand({ type: 'UPDATE_SETTINGS', settings: draft });
    setStatus(
      result.ok
        ? { ok: true, text: 'Settings saved.' }
        : { ok: false, text: describeFailure(result) },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Appearance">
        <Segmented
          label="Theme"
          value={draft.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(theme) => {
            setDraft({ ...draft, theme });
            setStatus(null);
          }}
        />
      </Section>

      <Section title="Reminders">
        <Toggle
          label="Notifications"
          hint="Each reminder is sent at most once a day."
          checked={n.enabled}
          onChange={(enabled) => {
            setN({ enabled });
          }}
        />
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="reminder-time" className="flex flex-col text-sm">
            Daily reminder
            <span className="text-xs text-muted">If today’s target is not met by then.</span>
          </label>
          <input
            id="reminder-time"
            type="time"
            value={n.reminderTime}
            disabled={!n.enabled}
            onChange={(e) => {
              if (e.target.value !== '') setN({ reminderTime: e.target.value });
            }}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm disabled:opacity-50"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="deadline" className="flex flex-col text-sm">
            Last call before midnight
            <span className="text-xs text-muted">A final nudge if you are still short.</span>
          </label>
          <select
            id="deadline"
            value={n.deadlineMinutesBefore}
            disabled={!n.enabled}
            onChange={(e) => {
              setN({ deadlineMinutesBefore: Number(e.target.value) });
            }}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm disabled:opacity-50"
          >
            {DEADLINE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0
                  ? 'Off'
                  : m < 60
                    ? `${String(m)} minutes before`
                    : `${String(m / 60)} hour${m === 60 ? '' : 's'} before`}
              </option>
            ))}
          </select>
        </div>
        <Toggle
          label="Target met"
          hint="A short note when you finish the day."
          checked={n.targetMet}
          disabled={!n.enabled}
          onChange={(targetMet) => {
            setN({ targetMet });
          }}
        />
        <Toggle
          label="Morning summary"
          hint="Yesterday’s result at 8:00 AM."
          checked={n.dailySummary}
          disabled={!n.enabled}
          onChange={(dailySummary) => {
            setN({ dailySummary });
          }}
        />
      </Section>

      <Section title="New challenges">
        <Toggle
          label="Count manual entries by default"
          hint="Applies to challenges you start later. A running challenge keeps its locked setting."
          checked={draft.countManualDefault}
          onChange={(countManualDefault) => {
            setDraft({ ...draft, countManualDefault });
            setStatus(null);
          }}
        />
        <p className="text-xs text-muted">Days run midnight to midnight in {DEFAULT_TIME_ZONE}.</p>
      </Section>

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()}>Save settings</Button>
        {status !== null && (
          <p
            role={status.ok ? 'status' : 'alert'}
            className={`text-sm ${status.ok ? 'text-accent' : 'text-danger'}`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
