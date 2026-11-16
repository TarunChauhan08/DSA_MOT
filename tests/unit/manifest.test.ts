import { describe, expect, it } from 'vitest';
import config from '../../wxt.config';

// Guards against permission creep. Changing these lists requires updating
// docs/PHASE_0_PROPOSAL.md §K and this test in the same reviewed change.
describe('manifest permissions', () => {
  const manifest = config.manifest;
  if (typeof manifest !== 'object' || manifest instanceof Promise) {
    throw new Error('Expected a static manifest object');
  }

  it('requests only the permissions used in this phase', () => {
    expect(manifest.permissions).toEqual(['sidePanel']);
  });

  it('requests no host permissions yet', () => {
    expect(manifest.host_permissions).toBeUndefined();
  });
});
