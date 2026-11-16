import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../design-system/styles.css';

export function mount(node: ReactNode): void {
  const container = document.getElementById('root');
  if (container === null) {
    throw new Error('Root element #root not found.');
  }
  createRoot(container).render(<StrictMode>{node}</StrictMode>);
}
