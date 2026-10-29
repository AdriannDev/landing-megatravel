import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowPopup, popupStorageKey, popupTimeRemaining, POPUP_DAY_MS } from '../src/lib/popup.ts'
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

test('el contador usa el fin real de la promoción, incluidos días y cambios de minuto', () => {
  const now = Date.parse('2026-10-29T12:00:00Z')
  assert.deepEqual(popupTimeRemaining('2026-10-30T14:03:04Z', now), { days: 1, hours: 2, minutes: 3, seconds: 4 })
  assert.deepEqual(popupTimeRemaining('2026-10-29T12:01:00Z', now), { days: 0, hours: 0, minutes: 1, seconds: 0 })
  assert.deepEqual(popupTimeRemaining('2026-10-29T12:01:00Z', now + 1000), { days: 0, hours: 0, minutes: 0, seconds: 59 })
  assert.deepEqual(popupTimeRemaining('2026-10-29T12:00:00.500Z', now), { days: 0, hours: 0, minutes: 0, seconds: 1 })
})

test('no hay contador sin fecha válida ni para una promoción vencida', () => {
  const now = Date.parse('2026-10-29T12:00:00Z')
  for (const end of [undefined, null, '', 'invalid', '2026-10-29T12:00:00Z', '2026-10-28T12:00:00Z']) {
    assert.equal(popupTimeRemaining(end, now), null)
  }
})
