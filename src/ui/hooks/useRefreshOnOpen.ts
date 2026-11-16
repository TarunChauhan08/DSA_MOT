import { useEffect } from 'react';
import { sendCommand } from '../../messaging/client';

/** Opening the popup or dashboard asks the worker for a (debounced) integration check. */
export function useRefreshOnOpen(): void {
  useEffect(() => {
    sendCommand({ type: 'REFRESH_INTEGRATIONS' }).catch((error: unknown) => {
      console.warn('[dsa] integration refresh failed', error);
    });
  }, []);
}
