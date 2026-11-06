import test from 'node:test';
import assert from 'node:assert/strict';

// Direct import of actual TypeScript utility implementation
import { sanitizeAppRoute } from '../src/utils/safeRoute.ts';
import { getReadIds, saveReadIds } from '../src/services/notificationStorage.ts';

test('sanitizeAppRoute: accepts valid relative in-app paths', () => {
  assert.equal(sanitizeAppRoute('/series/123'), '/series/123');
  assert.equal(sanitizeAppRoute('/category/dramas?page=2'), '/category/dramas?page=2');
  assert.equal(sanitizeAppRoute('/profile#settings'), '/profile#settings');
});

test('sanitizeAppRoute: parses and extracts huaplay:// custom scheme deep links', () => {
  assert.equal(sanitizeAppRoute('huaplay://series/456'), '/series/456');
  assert.equal(sanitizeAppRoute('huaplay:///explore'), '/explore');
  assert.equal(sanitizeAppRoute('huaplay://category/animes?sort=popular'), '/category/animes?sort=popular');
});

test('sanitizeAppRoute: accepts trusted production origins and extracts path', () => {
  assert.equal(
    sanitizeAppRoute('https://huaplay.playdb.info/series/789'),
    '/series/789',
  );
  assert.equal(
    sanitizeAppRoute('https://huaplay.app/series/999?ep=2'),
    '/series/999?ep=2',
  );
});

test('sanitizeAppRoute: strictly rejects backslash protocol bypass (/\\evil.com and \\\\)', () => {
  assert.equal(sanitizeAppRoute('/\\evil.example'), null);
  assert.equal(sanitizeAppRoute('/\\\\evil.example/phish'), null);
  assert.equal(sanitizeAppRoute('\\evil.example'), null);
  assert.equal(sanitizeAppRoute('/series\\123'), null);
});

test('sanitizeAppRoute: strictly rejects raw and encoded control characters', () => {
  assert.equal(sanitizeAppRoute('/series/123\r\nevil'), null);
  assert.equal(sanitizeAppRoute('/series/123\t'), null);
  assert.equal(sanitizeAppRoute('/series/123%00evil'), null);
  assert.equal(sanitizeAppRoute('/series/123%0d%0aheader-inject'), null);
  assert.equal(sanitizeAppRoute('/series/123%1f'), null);
  assert.equal(sanitizeAppRoute('/series/123%7f'), null);
});

test('sanitizeAppRoute: strictly rejects dangerous schemes and arbitrary external domains', () => {
  assert.equal(sanitizeAppRoute('javascript:alert(document.cookie)'), null);
  assert.equal(sanitizeAppRoute('JAVASCRIPT:alert(1)'), null);
  assert.equal(sanitizeAppRoute('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeAppRoute('vbscript:msgbox(1)'), null);
  assert.equal(sanitizeAppRoute('//evil.attacker.com/steal'), null);
  assert.equal(sanitizeAppRoute('https://evil.attacker.com/login'), null);
  assert.equal(sanitizeAppRoute('http://phishing.site/series/1'), null);
  assert.equal(sanitizeAppRoute(''), null);
  assert.equal(sanitizeAppRoute(null), null);
  assert.equal(sanitizeAppRoute(undefined), null);
});

test('bounded storage: verifies bounded storage trimming to at most 150 IDs', () => {
  // Mock localStorage in Node environment
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: store.size,
  };

  const testUid = 'user_bounded_test_456';
  const ids = new Set<number>();
  for (let i = 1; i <= 200; i++) {
    ids.add(i);
  }

  saveReadIds(ids, testUid);

  const restored = getReadIds(testUid);
  assert.equal(restored.size, 150);
  assert.equal(restored.has(1), false); // Oldest trimmed
  assert.equal(restored.has(50), false); // Oldest trimmed
  assert.equal(restored.has(51), true); // Retained
  assert.equal(restored.has(200), true); // Newest retained
});
