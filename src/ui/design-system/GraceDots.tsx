/** Grace days as dots: filled = still available, hollow = used. */
export function GraceDots({ remaining, total }: { remaining: number; total: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`${String(remaining)} of ${String(total)} grace days left`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full border-[1.5px] border-info ${i < remaining ? 'bg-info' : 'bg-transparent opacity-60'}`}
        />
      ))}
      <span className="ml-1 text-[13px] text-muted">
        {remaining} of {total}
      </span>
    </span>
  );
}
