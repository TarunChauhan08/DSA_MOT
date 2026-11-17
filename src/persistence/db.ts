import { Dexie, type EntityTable, type Table } from 'dexie';
import type {
  AuditEvent,
  ChallengeDayRecord,
  ChallengeRecord,
  CompletionRecord,
  MappingRecord,
  MetaRecord,
  NotificationLogRecord,
  PenaltyRecord,
} from './records';
import { SCHEMA_VERSIONS, type SchemaVersion } from './schema';

export const DATABASE_NAME = 'dsa-discipline';

export class DsaDatabase extends Dexie {
  declare challenges: EntityTable<ChallengeRecord, 'id'>;
  /** Compound primary key [challengeId+day]. */
  declare challengeDays: Table<ChallengeDayRecord, [string, string]>;
  declare penaltyRecords: EntityTable<PenaltyRecord, 'id'>;
  declare completions: EntityTable<CompletionRecord, 'id'>;
  declare mappings: EntityTable<MappingRecord, 'id'>;
  declare auditEvents: EntityTable<AuditEvent, 'seq'>;
  declare meta: EntityTable<MetaRecord, 'key'>;
  declare notificationLog: EntityTable<NotificationLogRecord, 'eventKey'>;

  constructor(name: string = DATABASE_NAME, versions: readonly SchemaVersion[] = SCHEMA_VERSIONS) {
    super(name);
    for (const v of versions) {
      const declared = this.version(v.version).stores(v.stores);
      if (v.upgrade !== undefined) declared.upgrade(v.upgrade);
    }
  }
}
