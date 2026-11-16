import { isValidSlug } from '../../domain/identity/identity';

/**
 * Striver A2Z sheet tick detection (recon 2026-11-16, docs/INTEGRATIONS.md).
 * Relies only on stable attributes shared by both layouts:
 *  - row: `[data-sheet-row-key]` (a `<tr>` on wide screens, an `<article>` on narrow ones)
 *  - checkbox: `[role="checkbox"]` with aria-label "Mark <title> complete"
 *  - problem rows link to `/practice/dsa/<slug>`; theory lessons link only to `/blogs/…`
 * Hashed CSS class names are never used.
 */
export const CHECKBOX_SELECTOR = '[role="checkbox"][aria-label^="Mark "]';
const ROW_SELECTOR = '[data-sheet-row-key]';
const PRACTICE_LINK_SELECTOR = 'a[href*="/practice/dsa/"]';
const LABEL_PATTERN = /^Mark\s+(.+?)\s+complete$/;
const MAX_TITLE_LENGTH = 200;

export interface SheetProblem {
  readonly slug: string;
  readonly title: string;
}

export function isChecked(el: Element): boolean {
  return el.getAttribute('aria-checked') === 'true' || el.getAttribute('data-state') === 'checked';
}

/** The practice problem a checkbox belongs to, or null for theory lessons / unknown markup. */
export function problemForCheckbox(checkbox: Element): SheetProblem | null {
  const row = checkbox.closest(ROW_SELECTOR);
  const href = row?.querySelector(PRACTICE_LINK_SELECTOR)?.getAttribute('href');
  if (href == null) return null;
  let path: string;
  try {
    path = new URL(href, 'https://takeuforward.org').pathname;
  } catch (error: unknown) {
    if (error instanceof TypeError) return null;
    throw error;
  }
  const slug = /^\/practice\/dsa\/([^/]+)\/?$/.exec(path)?.[1]?.toLowerCase();
  if (slug === undefined || !isValidSlug(slug)) return null;
  const label = checkbox.getAttribute('aria-label') ?? '';
  const title = (LABEL_PATTERN.exec(label)?.[1] ?? slug)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
  return { slug, title };
}

/**
 * Reports a problem only on an observed unticked → ticked transition. Boxes that are
 * already ticked when they appear (page load, expanding a module) are not imported,
 * because their real completion time is unknown.
 */
export function observeSheet(
  root: Document | Element,
  onTick: (problem: SheetProblem) => void,
): () => void {
  const known = new WeakMap<Element, boolean>();
  const remember = (scope: ParentNode) => {
    const boxes = scope instanceof Element && scope.matches(CHECKBOX_SELECTOR) ? [scope] : [];
    boxes.push(...scope.querySelectorAll(CHECKBOX_SELECTOR));
    for (const box of boxes) if (!known.has(box)) known.set(box, isChecked(box));
  };
  remember(root);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) remember(node);
        });
        continue;
      }
      const el = m.target;
      if (!(el instanceof Element) || !el.matches(CHECKBOX_SELECTOR)) continue;
      const before = known.get(el);
      const now = isChecked(el);
      known.set(el, now);
      if (before === false && now) {
        const problem = problemForCheckbox(el);
        if (problem !== null) onTick(problem);
      }
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'data-state'],
  });
  return () => {
    observer.disconnect();
  };
}
