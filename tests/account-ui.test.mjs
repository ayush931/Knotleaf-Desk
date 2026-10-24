import { test, expect, beforeAll, beforeEach, afterEach, afterAll, mock } from 'bun:test';
import React, { act } from 'react';
import { Window } from 'happy-dom';

let session = null, sessionError = null, signIn, signUp, signOut, social;
mock.module('../lib/authClient.ts', () => ({ authClient: {
  useSession: () => ({ data: session, isPending: false, error: sessionError, refetch() {} }),
  signIn: { email: (...args) => signIn(...args), social: (...args) => social(...args) },
  signUp: { email: (...args) => signUp(...args) },
  signOut: (...args) => signOut(...args),
} }));
const { AccountButton } = await import('../components/AccountButton.tsx');
let browser, root, createRoot, originalFetch;
const previous = new Map();
beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  for (const [key, value] of Object.entries({ window: browser, document: browser.document, navigator: browser.navigator, HTMLElement: browser.HTMLElement, Node: browser.Node, Event: browser.Event, KeyboardEvent: browser.KeyboardEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  ({ createRoot } = await import('react-dom/client'));
  originalFetch = globalThis.fetch;
});
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  session = null; sessionError = null;
  social = async () => ({ error: { status: 503 } });
  signIn = async () => ({ error: { status: 401 } });
  signUp = async () => ({ data: {} });
  signOut = async () => ({ data: {} });
  globalThis.fetch = async () => Response.json({ enabled: true, google: false });
});
afterEach(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
afterAll(() => { globalThis.fetch = originalFetch; browser.close(); for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent === text);
async function open() { await act(async () => root.render(React.createElement(AccountButton))); await act(async () => document.querySelector('[aria-label="Sign in"]').click()); }
async function change(selector, value) {
  const input = document.querySelector(selector);
  Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
  await act(async () => input.dispatchEvent(new browser.Event('input', { bubbles: true })));
}
async function submit() { await act(async () => document.querySelector('form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }))); }
test('sign-in form validates and focuses fields, supports password visibility and preserves failed credentials', async () => {
  await open();
  expect([...document.querySelectorAll('button')].find(el => el.textContent.endsWith('Continue with Google')).disabled).toBe(true);
  await submit();
  expect(document.activeElement.type).toBe('email');
  expect(document.activeElement.getAttribute('aria-invalid')).toBe('true');
  await change('input[type=email]', 'person@example.com');
  await change('input[autocomplete=current-password]', 'test passphrase');
  await act(async () => document.querySelector('[aria-label="Show password"]').click());
  expect(document.querySelector('input[autocomplete=current-password]').type).toBe('text');
  await submit();
  expect(document.querySelector('[role=alert]').textContent).toContain('Email or password is incorrect');
  expect(document.querySelector('input[type=email]').value).toBe('person@example.com');
  await act(async () => document.querySelector('[aria-label="Close account dialog"]').click());
  expect(document.querySelector('dialog')).toBe(null);
});
test('signup enforces password requirements and blocks duplicate requests while pending', async () => {
  await open();
  await act(async () => button('New here? Create an account').click());
  await change('input[autocomplete=name]', 'Test Person');
  await change('input[type=email]', 'person@example.com');
  await change('input[autocomplete=new-password]', 'short');
  await submit(); expect(document.activeElement.autocomplete).toBe('new-password');
  await change('input[autocomplete=new-password]', 'a long test passphrase');
  let finish, calls = 0;
  signUp = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  await submit(); await submit(); expect(calls).toBe(1); expect(document.querySelector('button[type=submit]').disabled).toBe(true);
  await act(async () => finish({ data: {} }));
  expect(document.querySelector('dialog')).toBe(null);
});
test('account displays identity and a failed sign-out stays recoverable', async () => {
  session = { user: { name: 'Test Person', email: 'person@example.com' } };
  await act(async () => root.render(React.createElement(AccountButton)));
  await act(async () => document.querySelector('[aria-label="Account: person@example.com"]').click());
  expect(document.querySelector('dialog').textContent).toContain('Boards and notes stay on this device');
  signOut = async () => ({ error: {} });
  await act(async () => button('Sign out').click());
  expect(document.querySelector('[role=alert]').textContent).toContain('Could not sign out');
  expect(button('Sign out').disabled).toBe(false);
});

test('only the Google button initiates OAuth; the dialog card is inert and pending clicks are deduplicated', async () => {
  globalThis.fetch = async () => Response.json({ enabled: true, google: true });
  let calls = 0, finish;
  social = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  await open();
  expect(document.querySelector('dialog').parentElement).toBe(document.body);
  await act(async () => document.querySelector('dialog').click());
  expect(calls).toBe(0);
  const google = document.querySelector('[aria-label="Continue with Google"]');
  expect(google.querySelector('svg')).not.toBe(null);
  expect(google.className).toContain('bg-white');
  await act(async () => { google.click(); google.click(); });
  expect(calls).toBe(1); expect(google.disabled).toBe(true);
  expect(google.textContent).toContain('Connecting');
  await act(async () => finish({ error: { status: 503 } }));
  expect(google.disabled).toBe(false);
  expect(document.querySelector('[role=alert]').textContent).toContain('Could not start Google sign-in');
});

test('Google navigation keeps the same card and leaves email controls visually unchanged', async () => {
  globalThis.fetch = async () => Response.json({ enabled: true, google: true });
  const originalAssign = window.location.assign;
  let destination;
  window.location.assign = value => { destination = value; };
  social = async () => ({ data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?test=1' } });
  try {
    await open();
    const card = document.querySelector('dialog'), email = document.querySelector('input[type=email]');
    const google = document.querySelector('[aria-label="Continue with Google"]');
    await act(async () => google.click());
    expect(destination).toContain('https://accounts.google.com/');
    expect(document.querySelector('dialog')).toBe(card);
    expect(document.querySelector('input[type=email]')).toBe(email);
    expect(email.disabled).toBe(false);
    expect(document.querySelector('form').hasAttribute('inert')).toBe(true);
    expect(document.querySelector('button[type=submit]').textContent).toBe('Sign in');
    expect(google.getAttribute('aria-busy')).toBe('true');
    expect(google.textContent).toContain('Connecting');
  } finally { window.location.assign = originalAssign; }
});
