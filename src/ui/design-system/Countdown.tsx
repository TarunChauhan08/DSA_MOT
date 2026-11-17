import type { Urgency } from '../../domain/analytics/nudges';

const STYLE: Record<Urgency, string> = {
  done: 'text-accent border-accent/30 bg-accent/10',
  calm: 'text-muted border-border bg-surface',
  'heads-up': 'text-warning border-warning/40 bg-warning/10',
  urgent: 'text-danger border-danger/50 bg-danger/10',
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function formatTimeLeft(ms: number): string {
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  return h > 0 ? `${String(h)}h ${String(m).padStart(2, '0')}m left` : `${String(m)}m left`;
}

/** Time to midnight, tinted by urgency. */
export function Countdown({ msLeft, urgency }: { msLeft: number; urgency: Urgency }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12.5px] font-medium ${STYLE[urgency]}`}
    >
      {urgency === 'done' ? 'Streak safe' : formatTimeLeft(msLeft)}
    </span>
  );
}
