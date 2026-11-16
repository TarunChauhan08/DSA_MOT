import { DsaDatabase } from '../persistence/db';

/** Read-only use from extension pages; all writes go through the service worker. */
export const uiDb = new DsaDatabase();
