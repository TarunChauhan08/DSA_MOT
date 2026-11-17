import type { ReactNode } from 'react';
import type { DayOutcome } from '../domain/challenge/evaluate';
import { CheckGlyph, CrossGlyph, DotGlyph, HalfGlyph, RingGlyph } from './design-system/glyphs';

export type DayTone = DayOutcome | 'TODAY' | 'UPCOMING';

interface ToneSpec {
  readonly label: string;
  /** Tailwind text colour class carrying the state colour. */
  readonly text: string;
  /** CSS variable for fills (strip segments, bars). */
  readonly color: string;
  readonly glyph: ReactNode;
}

/** The single colour code used everywhere (docs/DESIGN.md). */
export const TONES: Record<DayTone, ToneSpec> = {
  SUCCESS: {
    label: 'Target met',
    text: 'text-accent',
    color: 'var(--accent)',
    glyph: <CheckGlyph />,
  },
  PARTIAL_PENALIZED: {
    label: 'Partial',
    text: 'text-warning',
    color: 'var(--warning)',
    glyph: <HalfGlyph />,
  },
  ZERO_GRACE: { label: 'Grace day', text: 'text-info', color: 'var(--info)', glyph: <RingGlyph /> },
  ZERO_PENALIZED: {
    label: 'Missed',
    text: 'text-danger',
    color: 'var(--danger)',
    glyph: <CrossGlyph />,
  },
  TODAY: { label: 'Today', text: 'text-violet', color: 'var(--violet)', glyph: <DotGlyph /> },
  UPCOMING: {
    label: 'Upcoming',
    text: 'text-muted',
    color: 'var(--surface-raised)',
    glyph: <DotGlyph />,
  },
};

export function ToneLabel({ tone, children }: { tone: DayTone; children?: ReactNode }) {
  const spec = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap ${spec.text}`}
    >
      {spec.glyph}
      {children ?? spec.label}
    </span>
  );
}
