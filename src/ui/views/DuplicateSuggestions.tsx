import { useState } from 'react';
import type { DuplicateSuggestionView } from '../../application/queries';
import { platformOf } from '../../domain/identity/identity';
import { describeFailure, sendCommand } from '../../messaging/client';
import { Button } from '../design-system/Button';
import { Section } from '../design-system/Section';
import { PLATFORM_LABEL } from '../format';

/** User-assisted duplicate resolution (ADR-0006). Nothing merges without a decision. */
export function DuplicateSuggestions({
  suggestions,
}: {
  suggestions: readonly DuplicateSuggestionView[];
}) {
  const [error, setError] = useState<string | null>(null);
  if (suggestions.length === 0) return null;

  const decide = async (s: DuplicateSuggestionView, decision: 'SAME' | 'DIFFERENT') => {
    const result = await sendCommand({ type: 'DECIDE_MAPPING', a: s.a, b: s.b, decision });
    setError(result.ok ? null : describeFailure(result));
  };

  return (
    <Section title="Same problem on both platforms?">
      <p className="text-sm text-muted">
        These have the same name. If they are the same problem, it counts once per day.
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {suggestions.map((s) => (
          <li key={`${s.a}|${s.b}`} className="flex flex-col gap-2 py-2.5">
            <p className="text-sm">
              <span className="font-medium">{s.titleA}</span>{' '}
              <span className="text-muted">({PLATFORM_LABEL[platformOf(s.a)]})</span> and{' '}
              <span className="font-medium">{s.titleB}</span>{' '}
              <span className="text-muted">({PLATFORM_LABEL[platformOf(s.b)]})</span>
            </p>
            <div className="flex gap-2">
              <Button onClick={() => void decide(s, 'SAME')}>Same problem</Button>
              <Button variant="ghost" onClick={() => void decide(s, 'DIFFERENT')}>
                Different
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Section>
  );
}
