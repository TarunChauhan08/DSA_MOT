import { useId, useState, type ChangeEvent } from 'react';
import { browser } from 'wxt/browser';
import { exportBackup, parseBackup, type Backup } from '../../application/backup';
import { dayKeyOf, DEFAULT_TIME_ZONE } from '../../domain/calendar';
import { describeFailure, sendCommand } from '../../messaging/client';
import { uiDb } from '../db';
import { Button } from '../design-system/Button';
import { Section } from '../design-system/Section';
import { downloadText } from '../download';
import { formatDay } from '../format';

type Message = { readonly ok: boolean; readonly text: string } | null;

async function saveCurrentData(prefix: string): Promise<void> {
  const now = Date.now();
  const { json } = await exportBackup(uiDb, now, browser.runtime.getManifest().version);
  downloadText(`${prefix}-${dayKeyOf(now, DEFAULT_TIME_ZONE)}.json`, json);
}

export function DataSection() {
  const fileId = useId();
  const resetId = useId();
  const [preview, setPreview] = useState<{ backup: Backup; text: string } | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [resetText, setResetText] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setPreview(null);
    const file = e.target.files?.[0];
    if (file === undefined) return;
    const text = await file.text();
    const parsed = await parseBackup(text);
    if (parsed.ok) setPreview({ backup: parsed.backup, text });
    else setMessage({ ok: false, text: parsed.reason });
  };

  const restore = async () => {
    if (preview === null) return;
    setBusy(true);
    try {
      await saveCurrentData('dsa-discipline-before-restore');
      const result = await sendCommand({ type: 'IMPORT_BACKUP', json: preview.text });
      setMessage(
        result.ok
          ? { ok: true, text: `Restored ${result.detail ?? 'your backup'}.` }
          : { ok: false, text: describeFailure(result) },
      );
      if (result.ok) setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const result = await sendCommand({ type: 'RESET_DATA', confirmation: 'RESET' });
      setMessage(
        result.ok
          ? { ok: true, text: 'All data deleted.' }
          : { ok: false, text: describeFailure(result) },
      );
      setResetText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Your data">
      <p className="text-sm text-muted">
        Everything stays on this computer. Download a backup to keep a copy or move to another
        browser.
      </p>
      <div>
        <Button
          variant="ghost"
          className="border border-border"
          onClick={() => void saveCurrentData('dsa-discipline-backup')}
        >
          Download backup
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={fileId} className="text-sm">
          Restore from a backup
        </label>
        <input
          id={fileId}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void onFile(e)}
          className="text-sm text-muted file:mr-3 file:h-8 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:text-sm file:text-text"
        />
        {preview !== null && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
            <p>
              Backup from {formatDay(dayKeyOf(preview.backup.exportedAtMs, DEFAULT_TIME_ZONE))} with{' '}
              {preview.backup.data.challenges.length} challenges and{' '}
              {preview.backup.data.completions.length} solved problems. Restoring replaces all
              current data; a copy of your current data downloads first.
            </p>
            <div>
              <Button disabled={busy} onClick={() => void restore()}>
                Replace my data with this backup
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <label htmlFor={resetId} className="text-sm">
          Delete all data
          <span className="block text-xs text-muted">
            Removes challenges, problems, penalties, settings and the LeetCode connection. Type
            RESET to confirm.
          </span>
        </label>
        <div className="flex gap-2">
          <input
            id={resetId}
            value={resetText}
            onChange={(e) => {
              setResetText(e.target.value);
            }}
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
          />
          <Button
            className="bg-danger text-white hover:bg-danger/90"
            disabled={resetText !== 'RESET' || busy}
            onClick={() => void reset()}
          >
            Delete all data
          </Button>
        </div>
      </div>

      {message !== null && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={`text-sm ${message.ok ? 'text-accent' : 'text-danger'}`}
        >
          {message.text}
        </p>
      )}
    </Section>
  );
}
