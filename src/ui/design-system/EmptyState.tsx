import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border px-5 py-6">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <p className="max-w-prose text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}
