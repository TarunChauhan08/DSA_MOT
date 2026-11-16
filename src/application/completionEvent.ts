import { z } from 'zod';
import { isValidSlug, type Platform } from '../domain/identity/identity';

/**
 * Untrusted input boundary: everything an integration, content script or the UI
 * may submit as a completion. Validated with Zod before it reaches the domain.
 */
const slug = z.string().refine(isValidSlug, { message: 'Invalid problem slug' });
const title = z.string().trim().min(1).max(200);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const RawCompletionEventSchema = z.discriminatedUnion('evidence', [
  z.object({
    evidence: z.literal('LC_RECENT_AC'),
    submissionId: z.string().regex(/^\d{1,20}$/),
    slug,
    title,
    sourceTimestampMs: timestamp,
  }),
  z.object({
    evidence: z.literal('TUF_SUBMISSION_ACCEPTED'),
    submissionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    slug,
    title,
    sourceTimestampMs: timestamp,
  }),
  z.object({
    evidence: z.literal('TUF_SHEET_CHECKBOX'),
    slug,
    title,
  }),
  z.object({
    evidence: z.literal('USER_MANUAL'),
    platform: z.enum(['leetcode', 'tuf']),
    slug,
    title,
  }),
]);

export type RawCompletionEvent = z.infer<typeof RawCompletionEventSchema>;

/** Problem URLs are built from the validated slug, never copied from page data. */
export function problemUrl(platform: Platform, problemSlug: string): string {
  const s = encodeURIComponent(problemSlug.trim().toLowerCase());
  return platform === 'leetcode'
    ? `https://leetcode.com/problems/${s}/`
    : `https://takeuforward.org/practice/dsa/${s}`;
}
