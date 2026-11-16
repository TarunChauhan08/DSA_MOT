import type { ReactNode } from 'react';

export type BadgeTone = 'accent' | 'muted' | 'info' | 'violet' | 'warning' | 'danger';

const TONES: Record<BadgeTone, string> = {
  accent: 'text-accent border-accent/40 bg-accent/10',
  muted: 'text-muted border-border bg-surface-raised',
  info: 'text-info border-info/40 bg-info/10',
  violet: 'text-violet border-violet/40 bg-violet/10',
  warning: 'text-warning border-warning/40 bg-warning/10',
  danger: 'text-danger border-danger/40 bg-danger/10',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
