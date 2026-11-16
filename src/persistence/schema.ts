import type { Transaction } from 'dexie';

/**
 * Versioned schema. Never edit a released version: append a new one with an
 * `upgrade` that migrates existing data (tests/integration/migrations.test.ts).
 */
export interface SchemaVersion {
  readonly version: number;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly upgrade?: (tx: Transaction) => Promise<void>;
}

export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      challenges: 'id, status, startDay',
      challengeDays: '[challengeId+day], challengeId',
      penaltyRecords: '++id, [challengeId+day], challengeId',
      completions: 'id, sourceKey, sourceTimestampMs',
      mappings: 'id',
      auditEvents: '++seq, type, atMs',
      meta: 'key',
    },
  },
];

export const LATEST_SCHEMA_VERSION = SCHEMA_VERSIONS.reduce((m, v) => Math.max(m, v.version), 0);
