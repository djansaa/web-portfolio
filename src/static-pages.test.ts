import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = [
  { file: 'index.html', route: '/web-portfolio/' },
  { file: 'art/index.html', route: '/web-portfolio/art/' },
  { file: 'dev/index.html', route: '/web-portfolio/dev/' },
];

describe('branch-published static pages', () => {
  it.each(pages)('$route resolves its stylesheet and runnable JavaScript within the project', ({ file, route }) => {
    const html = readFileSync(resolve(root, file), 'utf8');
    const stylesheet = html.match(/<link rel="stylesheet" href="([^"]+)"/);
    const script = html.match(/<script defer src="([^"]+)"/);
    expect(stylesheet?.[1]).toBeTruthy();
    expect(script?.[1]).toBeTruthy();
    for (const reference of [stylesheet![1], script![1]]) {
      const url = new URL(reference, `https://djansaa.github.io${route}`);
      expect(url.pathname.startsWith('/web-portfolio/')).toBe(true);
      const local = resolve(root, url.pathname.slice('/web-portfolio/'.length));
      expect(existsSync(local)).toBe(true);
    }
  });

  it('boots the prebuilt editor and wires its action buttons', () => {
    class FakeElement {
      dataset: Record<string, string> = {};
      innerHTML = '';
      textContent = '';
      listeners = new Map<string, Array<() => void>>();
      classList = { toggle: () => undefined };
      addEventListener(name: string, listener: () => void): void {
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
      }
      setAttribute(): void { /* UI attribute state is outside this smoke test. */ }
      querySelector(): null { return null; }
    }
    const ids = ['#case-list', '#findings', '#finding-count', '#save-status', '#workspace-title', '#manual-value', '#export-warning', '#warning-text', '#add-case', '#clear-draft', '#add-manual', '#export-docx', '#export-pdf', '#year'];
    const elements = new Map(ids.map((id) => [id, new FakeElement()]));
    const tabs = ['rest', 'soap'].map((mode) => Object.assign(new FakeElement(), { dataset: { mode } }));
    let nextId = 0;
    runInNewContext(readFileSync(resolve(root, 'assets/dev.js'), 'utf8'), {
      document: {
        querySelector: (selector: string) => elements.get(selector) ?? null,
        querySelectorAll: (selector: string) => selector === '.mode-tab' ? tabs : [],
        addEventListener: () => undefined,
      },
      HTMLElement: FakeElement,
      localStorage: { getItem: () => null, setItem: () => undefined },
      window: { setTimeout: () => 1, clearTimeout: () => undefined, addEventListener: () => undefined },
      crypto: { randomUUID: () => `case-${++nextId}` },
      structuredClone,
      console,
    });
    const cards = (): number => (elements.get('#case-list')!.innerHTML.match(/class="case-card"/g) ?? []).length;
    expect(cards()).toBe(1);
    elements.get('#add-case')!.listeners.get('click')![0]();
    expect(cards()).toBe(2);
    expect(elements.get('#export-docx')!.listeners.has('click')).toBe(true);
    expect(elements.get('#export-pdf')!.listeners.has('click')).toBe(true);
    tabs[1].listeners.get('click')![0]();
    expect(elements.get('#workspace-title')!.textContent).toBe('SOAP document');
  });
});
