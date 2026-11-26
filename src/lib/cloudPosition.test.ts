import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCloudAnchor } from './cloudPosition';

test('computeCloudAnchor places cloud cleanly next to pointer and flips when near right edge', () => {
  const normal = computeCloudAnchor({
    clickX: 400,
    clickY: 300,
    viewportW: 1440,
    viewportH: 900,
  });
  assert.equal(normal.left, 418);
  assert.equal(normal.width, 328);
  assert.ok(normal.top >= 16 && normal.top + normal.maxHeight <= 900 - 16);

  const nearRight = computeCloudAnchor({
    clickX: 1350,
    clickY: 820,
    viewportW: 1440,
    viewportH: 900,
  });
  assert.ok(nearRight.left < 1350);
  assert.ok(nearRight.left + nearRight.width <= 1440 - 16);
  assert.ok(nearRight.top + nearRight.maxHeight <= 900 - 16);
});

test('computeCloudAnchor provides clean default right-side placement without pointer coords', () => {
  const fallback = computeCloudAnchor({
    viewportW: 1440,
    viewportH: 900,
  });
  assert.equal(fallback.left, 1440 - 328 - 20);
  assert.equal(fallback.top, 108);
});
