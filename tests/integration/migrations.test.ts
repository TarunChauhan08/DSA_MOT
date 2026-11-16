import { describe, expect, it } from 'vitest';
import { DsaDatabase } from '../../src/persistence/db';
import {
  LATEST_SCHEMA_VERSION,
  SCHEMA_VERSIONS,
  type SchemaVersion,
} from '../../src/persistence/schema';

const v1 = SCHEMA_VERSIONS.filter((v) => v.version === 1);

describe('schema and migrations', () => {
  it('opens at the latest declared version with every table', async () => {
    const db = new DsaDatabase(`mig-${String(Math.random())}`);
    await db.open();
    expect(db.verno).toBe(LATEST_SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'auditEvents',
      'challengeDays',
      'challenges',
      'completions',
      'mappings',
      'meta',
      'penaltyRecords',
    ]);
    db.close();
  });

  it('keeps data across close and reopen (browser restart)', async () => {
    const name = `mig-${String(Math.random())}`;
    const first = new DsaDatabase(name);
    await first.meta.put({ key: 'probe', value: 42 });
    first.close();
    const second = new DsaDatabase(name);
    expect(await second.meta.get('probe')).toEqual({ key: 'probe', value: 42 });
    second.close();
  });

  it('runs upgrade functions on existing data without losing it (harness check)', async () => {
    const name = `mig-${String(Math.random())}`;
    const old = new DsaDatabase(name, v1);
    await old.meta.put({ key: 'theme', value: 'dark' });
    old.close();

    const hypotheticalV2: SchemaVersion = {
      version: 2,
      stores: { notificationLog: 'eventKey' },
      upgrade: async (tx) => {
        await tx.table('meta').put({ key: 'migratedFrom', value: 1 });
      },
    };
    const upgraded = new DsaDatabase(name, [...v1, hypotheticalV2]);
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.meta.get('theme')).toEqual({ key: 'theme', value: 'dark' });
    expect(await upgraded.meta.get('migratedFrom')).toEqual({ key: 'migratedFrom', value: 1 });
    upgraded.close();
  });

  it('declares versions in strictly increasing order', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
  });
});
