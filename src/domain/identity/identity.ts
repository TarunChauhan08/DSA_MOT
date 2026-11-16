export type Platform = 'leetcode' | 'tuf';
export type SourceKey = string & { readonly __brand: 'SourceKey' };
/** The canonical key of a problem group; always equal to one of its source keys. */
export type CanonicalKey = string & { readonly __brand: 'CanonicalKey' };

const PREFIX: Readonly<Record<Platform, string>> = { leetcode: 'lc', tuf: 'tuf' };
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 200;

export function isValidSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return normalized.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(normalized);
}

/** Builds `lc:<slug>` / `tuf:<slug>`. Slugs come from untrusted pages, so they are validated. */
export function makeSourceKey(platform: Platform, slug: string): SourceKey {
  if (!isValidSlug(slug)) {
    throw new RangeError(`Invalid ${platform} slug: ${JSON.stringify(slug.slice(0, 40))}`);
  }
  return `${PREFIX[platform]}:${slug.trim().toLowerCase()}` as SourceKey;
}

/** Canonical key of a source key that has not been merged with any other. */
export function soloCanonicalKey(key: SourceKey): CanonicalKey {
  return key as string as CanonicalKey;
}

export function platformOf(key: SourceKey): Platform {
  return key.startsWith('lc:') ? 'leetcode' : 'tuf';
}

export interface MappingDecision {
  readonly a: SourceKey;
  readonly b: SourceKey;
  readonly decision: 'SAME' | 'DIFFERENT';
  readonly decidedAtMs: number;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function latestDecisions(decisions: readonly MappingDecision[]): Map<string, MappingDecision> {
  const latest = new Map<string, MappingDecision>();
  for (const d of decisions) {
    const key = pairKey(d.a, d.b);
    const current = latest.get(key);
    if (current === undefined || d.decidedAtMs >= current.decidedAtMs) latest.set(key, d);
  }
  return latest;
}

/**
 * Groups source keys the user confirmed as the SAME problem (transitively).
 * Titles never merge anything on their own (ADR-0006).
 */
export function resolveCanonicalKeys(
  keys: readonly SourceKey[],
  decisions: readonly MappingDecision[],
): Map<SourceKey, CanonicalKey> {
  const parent = new Map<SourceKey, SourceKey>();
  const find = (k: SourceKey): SourceKey => {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    parent.set(k, root);
    return root;
  };
  const add = (k: SourceKey) => {
    if (!parent.has(k)) parent.set(k, k);
  };

  keys.forEach(add);
  for (const d of latestDecisions(decisions).values()) {
    add(d.a);
    add(d.b);
    if (d.decision === 'SAME') {
      const [ra, rb] = [find(d.a), find(d.b)];
      if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
    }
  }

  const result = new Map<SourceKey, CanonicalKey>();
  for (const k of parent.keys()) result.set(k, soloCanonicalKey(find(k)));
  return result;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface DuplicateSuggestion {
  readonly a: SourceKey;
  readonly b: SourceKey;
}

/** Cross-platform pairs with identical normalized titles that the user has not decided on. */
export function suggestDuplicates(
  problems: ReadonlyArray<{ readonly sourceKey: SourceKey; readonly title: string }>,
  decisions: readonly MappingDecision[],
): DuplicateSuggestion[] {
  const decided = new Set(decisions.map((d) => pairKey(d.a, d.b)));
  const suggestions: DuplicateSuggestion[] = [];
  for (let i = 0; i < problems.length; i += 1) {
    for (let j = i + 1; j < problems.length; j += 1) {
      const p = problems[i];
      const q = problems[j];
      if (p === undefined || q === undefined) continue;
      if (platformOf(p.sourceKey) === platformOf(q.sourceKey)) continue;
      if (normalizeTitle(p.title) !== normalizeTitle(q.title)) continue;
      if (decided.has(pairKey(p.sourceKey, q.sourceKey))) continue;
      const [a, b] =
        p.sourceKey < q.sourceKey ? [p.sourceKey, q.sourceKey] : [q.sourceKey, p.sourceKey];
      suggestions.push({ a, b });
    }
  }
  return suggestions;
}
