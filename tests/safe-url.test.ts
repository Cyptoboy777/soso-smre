import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHttpUrl } from '../lib/safe-url.ts';

test('safeHttpUrl keeps normal http(s) links', () => {
  assert.equal(safeHttpUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeHttpUrl('  http://example.com  '), 'http://example.com/');
});

test('safeHttpUrl blocks javascript:, data: and other schemes in any casing or spacing', () => {
  for (const bad of [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', '\tjavascript:alert(1)', 'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd', 'blob:https://x/y', 'ftp://example.com',
  ]) assert.equal(safeHttpUrl(bad), undefined, bad);
});

test('safeHttpUrl rejects relative, empty, non-string and oversized values', () => {
  for (const bad of ['/relative', '#', '//evil.com', '', '   ', undefined, null, 5, {}, [], 'https://' + 'a'.repeat(3000)]) assert.equal(safeHttpUrl(bad as unknown), undefined);
});
