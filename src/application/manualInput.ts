import type { Platform } from '../domain/identity/identity';

export type ManualProblem =
  | {
      readonly ok: true;
      readonly platform: Platform;
      readonly slug: string;
      readonly title: string;
    }
  | { readonly ok: false; readonly message: string };

const MAX_LENGTH = 200;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '');
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseUrl(input: string): URL | null {
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}\//i.test(candidate)) return null;
  try {
    return new URL(candidate);
  } catch (error: unknown) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

/**
 * Reads what the user typed in "Add a problem": a LeetCode or takeUforward problem
 * link, or a plain problem name on the chosen platform.
 */
export function parseManualProblem(input: string, platformForNames: Platform): ManualProblem {
  const text = input.trim();
  if (text === '') return { ok: false, message: 'Enter a problem link or name.' };

  const url = parseUrl(text);
  if (url !== null) {
    const host = url.hostname.replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'leetcode.com') {
      const slug = parts[0] === 'problems' && parts[1] !== undefined ? slugify(parts[1]) : '';
      if (slug === '') return { ok: false, message: 'That LeetCode link is not a problem page.' };
      return { ok: true, platform: 'leetcode', slug, title: titleFromSlug(slug) };
    }
    if (host === 'takeuforward.org') {
      const slug =
        parts[0] === 'practice' && parts[1] === 'dsa' && parts[2] !== undefined
          ? slugify(parts[2])
          : '';
      if (slug === '')
        return { ok: false, message: 'That takeUforward link is not a practice problem.' };
      return { ok: true, platform: 'tuf', slug, title: titleFromSlug(slug) };
    }
    return { ok: false, message: 'Only LeetCode and takeUforward links are supported.' };
  }

  const slug = slugify(text);
  if (slug === '') return { ok: false, message: 'Use letters or numbers in the problem name.' };
  return {
    ok: true,
    platform: platformForNames,
    slug,
    title: text.replace(/\s+/g, ' ').slice(0, MAX_LENGTH),
  };
}
