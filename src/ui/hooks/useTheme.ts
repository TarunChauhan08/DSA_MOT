import { useEffect } from 'react';
import type { Settings } from '../../application/settings';

/** Applies the theme setting to <html data-theme>; "system" follows the OS. */
export function useTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
    };
  }, [theme]);
}
