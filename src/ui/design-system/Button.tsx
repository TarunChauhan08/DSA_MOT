import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-strong',
  ghost: 'text-text hover:bg-surface-raised',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
