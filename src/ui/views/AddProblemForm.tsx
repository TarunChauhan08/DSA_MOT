import { useId, useState, type SyntheticEvent } from 'react';
import { parseManualProblem } from '../../application/manualInput';
import type { Platform } from '../../domain/identity/identity';
import { describeFailure, sendCommand } from '../../messaging/client';
import { Button } from '../design-system/Button';

export function AddProblemForm() {
  const inputId = useId();
  const [text, setText] = useState('');
  const [platform, setPlatform] = useState<Platform>('leetcode');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdded(null);
    const parsed = parseManualProblem(text, platform);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setPending(true);
    const result = await sendCommand({
      type: 'ADD_MANUAL_PROBLEM',
      platform: parsed.platform,
      slug: parsed.slug,
      title: parsed.title,
    }).finally(() => {
      setPending(false);
    });
    if (!result.ok) {
      setError(describeFailure(result));
      return;
    }
    setError(null);
    setText('');
    setAdded(parsed.title);
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor={inputId} className="text-sm text-muted">
        Paste a LeetCode or takeUforward problem link, or type the problem name.
      </label>
      <input
        id={inputId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="Link or problem name"
        autoComplete="off"
        aria-invalid={error !== null}
        className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-muted/70"
      />
      <div className="flex gap-2">
        <select
          aria-label="Platform for problem names"
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value === 'tuf' ? 'tuf' : 'leetcode');
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm"
        >
          <option value="leetcode">Name is a LeetCode problem</option>
          <option value="tuf">Name is a Striver A2Z problem</option>
        </select>
        <Button type="submit" disabled={pending}>
          Add problem
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {added !== null && (
        <p role="status" className="text-sm text-muted">
          Added “{added}” as a manual entry.
        </p>
      )}
    </form>
  );
}
