import type { ReactNode } from 'react';

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-text">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
