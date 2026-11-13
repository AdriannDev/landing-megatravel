import test from 'node:test'
import assert from 'node:assert/strict'
import { bannersForViewport } from '../src/lib/banners.ts'

test('hero y rompetráfico filtran imágenes móviles antes de contar; escritorio conserva todos', () => {
  const items = [{ id: 'desktop' }, { id: 'mobile', mobileUrl: '/mobile.webp' }, { id: 'empty', mobileUrl: ' ' }]
  for (const placement of ['hero', 'between-results']) {
    assert.deepEqual(bannersForViewport(items, placement, true).map(b => b.id), ['mobile'])
    assert.deepEqual(bannersForViewport(items, placement, false), items)
    assert.deepEqual(bannersForViewport([items[0], items[2]], placement, true), [])
    assert.equal(bannersForViewport([items[1]], placement, true).length, 1)
  }
  assert.deepEqual(bannersForViewport(items, 'catalog-end', true), items)
  assert.deepEqual(bannersForViewport(items, 'popup', true), items)
})
