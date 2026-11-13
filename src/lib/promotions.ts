import type { Promotion } from './types.ts'
import { normalize } from './catalog.ts'

export function hasFlashSale(promotions: Promotion[]) {
  return promotions.some(promotion =>
    [promotion.id, promotion.name, promotion.label].some(value =>
      /^flash[\s_-]*sale$/.test(normalize(value)),
    ),
  )
}
