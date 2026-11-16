import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, parseRoute, routeHref } from '../../src/ui/routing/routes';

describe('parseRoute', () => {
  it.each([
    ['#/today', 'today'],
    ['#/history', 'history'],
    ['#history', 'history'],
    ['#/integrations?x=1', 'integrations'],
    ['#/settings/advanced', 'settings'],
  ] as const)('parses %s → %s', (hash, expected) => {
    expect(parseRoute(hash)).toBe(expected);
  });

  it('falls back to the default route for empty or unknown hashes', () => {
    expect(parseRoute('')).toBe(DEFAULT_ROUTE);
    expect(parseRoute('#/')).toBe(DEFAULT_ROUTE);
    expect(parseRoute('#/wallet')).toBe(DEFAULT_ROUTE);
  });

  it('uses the provided fallback', () => {
    expect(parseRoute('', 'settings')).toBe('settings');
  });

  it('round-trips with routeHref', () => {
    expect(parseRoute(routeHref('setup'))).toBe('setup');
  });
});
