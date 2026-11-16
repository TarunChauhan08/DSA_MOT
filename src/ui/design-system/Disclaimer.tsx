/** Exact wording is a product requirement (docs/PRD.md §2). Do not paraphrase. */
export const VIRTUAL_PENALTY_DISCLAIMER =
  'Virtual penalty only. No actual money is collected, transferred, owed or donated.';

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p role="note" className={`text-xs leading-relaxed text-muted ${className}`}>
      {VIRTUAL_PENALTY_DISCLAIMER}
    </p>
  );
}
