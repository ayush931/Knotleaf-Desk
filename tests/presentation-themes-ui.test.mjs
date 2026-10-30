import { test, expect } from 'bun:test';
import React, { act } from 'react';
import { Window } from 'happy-dom';
import { parseSlides } from '../lib/presentations/model.ts';

test('theme gallery previews the current slide, filters themes, and preserves overrides', async () => {
  const browser = new Window({ url: 'http://localhost:3000' }), saved = new Map();
  for (const [key, value] of Object.entries({ window: browser, document: browser.document, navigator: browser.navigator, HTMLElement: browser.HTMLElement, getComputedStyle: browser.getComputedStyle.bind(browser), IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  browser.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  browser.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const { createRoot } = await import('react-dom/client');
  const { PresentationThemes } = await import('../components/PresentationThemes.tsx');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const deck = { version: 1, title: 'Test', source: '', theme: 'midnight', layout: 'standard', backgroundColor: '#123456' };
  const slide = parseSlides('<!-- theme: paper -->\n# My actual slide')[0];
  let chosen, closed = 0;
  try {
    await act(async () => root.render(React.createElement(PresentationThemes, { open: true, value: deck.theme, deck, slide, onChange: value => chosen = value, onClose: () => closed++ })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 300)));
    expect(container.textContent).toContain('My actual slide');
    expect(container.textContent).toContain('own theme override');
    expect(container.textContent).toContain('custom background');
    expect(container.querySelector('[aria-label="Use Grove theme"] .kl-slide')?.dataset.theme).toBe('grove');
    expect(container.querySelector('[aria-label="Use Grove theme"] .kl-slide')?.style.getPropertyValue('--deck-bg')).toBe('#123456');
    const preview = container.querySelector('[aria-label="Theme preview content"]');
    await act(async () => { preview.value = 'sample'; preview.dispatchEvent(new browser.Event('change', { bubbles: true })); });
    await act(async () => new Promise(resolve => setTimeout(resolve, 250)));
    expect(container.querySelector('[aria-label="Use Grove theme"] .kl-slide')?.textContent).toContain('A clear perspective');
    const buttons = () => [...container.querySelectorAll('button')];
    await act(async () => buttons().find(button => button.textContent === 'light').click());
    expect(container.querySelector('[aria-label="Use Grove theme"]')).toBeNull();
    expect(container.querySelector('[aria-label="Use Editorial theme"]')).not.toBeNull();
    await act(async () => buttons().find(button => button.textContent === 'dark').click());
    expect(container.querySelector('[aria-label="Use Editorial theme"]')).toBeNull();
    await act(async () => container.querySelector('[aria-label="Use Grove theme"]').click());
    expect(chosen).toBe('grove'); expect(closed).toBe(1);
  } finally {
    await act(async () => root.unmount()); browser.close();
    for (const [key, value] of saved) if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key];
  }
});
