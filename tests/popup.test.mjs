import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowPopup, popupStorageKey, POPUP_DAY_MS } from '../src/lib/popup.ts'
import { bannersAt } from '../src/lib/banners.ts'

test('popup respeta sesión, 24 horas y cada visita', () => {
  const now = Date.parse('2026-10-28T12:00:00Z')
  assert.equal(shouldShowPopup('session', null, now), true)
  assert.equal(shouldShowPopup(undefined, String(now), now), false)
  assert.equal(shouldShowPopup('session', String(now - POPUP_DAY_MS), now), false)
  assert.equal(shouldShowPopup('daily', String(now - POPUP_DAY_MS + 1), now), false)
  assert.equal(shouldShowPopup('daily', String(now - POPUP_DAY_MS), now), true)
  assert.equal(shouldShowPopup('always', String(now), now), true)
  assert.equal(shouldShowPopup('daily', 'invalid', now), true)
})
test('cada anuncio y nueva campaña conservan su frecuencia independiente', () => {
  assert.notEqual(popupStorageKey({ id: '1' }), popupStorageKey({ id: '2' }))
  assert.notEqual(popupStorageKey({ id: '1' }), popupStorageKey({ id: '1', startsAt: '2026-11-01' }))
})
test('se elige solo el primer popup vigente sin mezclar banners', () => {
  const now = new Date('2026-10-28T12:00:00Z')
  const items = [{ id: '1', placement: 'hero' }, { id: '2', placement: 'popup', order: 2 }, { id: '3', placement: 'popup', order: 1 }, { id: '4', placement: 'popup', endsAt: now.toISOString() }, { id: '5', placement: 'popup', startsAt: '2027-01-01' }]
  assert.deepEqual(bannersAt(items, 'popup', now).map(p => p.id), ['3', '2'])
})
