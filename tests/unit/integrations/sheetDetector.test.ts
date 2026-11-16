import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  observeSheet,
  problemForCheckbox,
  type SheetProblem,
} from '../../../src/integrations/tuf/sheetDetector';

// Markup modelled on the live sheet (recorded 2026-11-16): wide = <tr>, narrow = <article>.
function row(
  layout: 'wide' | 'narrow',
  key: string,
  title: string,
  href: string,
  checked = false,
): string {
  const box = `<button type="button" role="checkbox" aria-checked="${String(checked)}" data-state="${checked ? 'checked' : 'unchecked'}" data-slot="checkbox" aria-label="Mark ${title} complete"></button>`;
  const link = `<a href="${href}" target="_blank" class="x__hash">icon</a>`;
  return layout === 'wide'
    ? `<tr data-slot="table-row" data-row-type="practice" data-sheet-row-key="${key}"><td>${box}</td><td><span>${title}</span></td><td>${link}</td></tr>`
    : `<article role="button" data-sheet-row-key="${key}"><div>${box}</div><span>${title}</span>${link}</article>`;
}

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

const tick = (box: Element, checked = true) => {
  box.setAttribute('aria-checked', String(checked));
  box.setAttribute('data-state', checked ? 'checked' : 'unchecked');
};

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(['wide', 'narrow'] as const)('%s layout', (layout) => {
  it('reads slug and title of a practice problem', () => {
    mount(
      `<table><tbody>${row(layout, 'practice-947', 'Selection Sort', '/practice/dsa/selection-sort')}</tbody></table>`,
    );
    expect(problemForCheckbox(document.querySelector('[role=checkbox]') as Element)).toEqual({
      slug: 'selection-sort',
      title: 'Selection Sort',
    });
  });

  it('ignores theory lessons (blog links only)', () => {
    mount(
      `<table><tbody>${row(layout, 'practice-17136', 'Breaking The Myth', '/blogs/data-structure-and-algorithm/breaking-the-myth')}</tbody></table>`,
    );
    expect(problemForCheckbox(document.querySelector('[role=checkbox]') as Element)).toBeNull();
  });

  it('reports an unticked → ticked transition once', async () => {
    mount(
      `<table><tbody>${row(layout, 'practice-1', 'Bubble Sort', '/practice/dsa/bubble-sort')}</tbody></table>`,
    );
    const onTick = vi.fn<(p: SheetProblem) => void>();
    const stop = observeSheet(document, onTick);
    const box = document.querySelector('[role=checkbox]') as Element;
    tick(box);
    await flush();
    expect(onTick).toHaveBeenCalledExactlyOnceWith({ slug: 'bubble-sort', title: 'Bubble Sort' });
    stop();
  });
});

describe('observeSheet', () => {
  it('does not import boxes that were already ticked on load or when a module expands', async () => {
    mount(
      `<table><tbody>${row('wide', 'practice-1', 'A', '/practice/dsa/a', true)}</tbody></table><div id="module"></div>`,
    );
    const onTick = vi.fn();
    const stop = observeSheet(document, onTick);
    (document.getElementById('module') as HTMLElement).innerHTML = row(
      'narrow',
      'practice-2',
      'B',
      '/practice/dsa/b',
      true,
    );
    await flush();
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });

  it('detects a tick on a row that appeared after load', async () => {
    mount('<div id="module"></div>');
    const onTick = vi.fn();
    const stop = observeSheet(document, onTick);
    (document.getElementById('module') as HTMLElement).innerHTML = row(
      'narrow',
      'practice-2',
      'Two Sum',
      '/practice/dsa/two-sum',
    );
    await flush();
    tick(document.querySelector('[role=checkbox]') as Element);
    await flush();
    expect(onTick).toHaveBeenCalledWith({ slug: 'two-sum', title: 'Two Sum' });
    stop();
  });

  it('ignores unticking, and re-ticking reports again (the worker dedupes per day)', async () => {
    mount(`<table><tbody>${row('wide', 'practice-1', 'A', '/practice/dsa/a')}</tbody></table>`);
    const onTick = vi.fn();
    const stop = observeSheet(document, onTick);
    const box = document.querySelector('[role=checkbox]') as Element;
    tick(box);
    await flush();
    tick(box, false);
    await flush();
    tick(box);
    await flush();
    expect(onTick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('rejects malformed slugs and survives unknown markup', async () => {
    mount(
      `<table><tbody>${row('wide', 'p', 'X', '/practice/dsa/<script>')}</tbody></table><button role="checkbox" aria-label="Mark Orphan complete" aria-checked="false"></button>`,
    );
    const onTick = vi.fn();
    const stop = observeSheet(document, onTick);
    document.querySelectorAll('[role=checkbox]').forEach((b) => {
      tick(b);
    });
    await flush();
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });

  it('stops observing when disposed', async () => {
    mount(`<table><tbody>${row('wide', 'p', 'A', '/practice/dsa/a')}</tbody></table>`);
    const onTick = vi.fn();
    observeSheet(document, onTick)();
    tick(document.querySelector('[role=checkbox]') as Element);
    await flush();
    expect(onTick).not.toHaveBeenCalled();
  });
});
