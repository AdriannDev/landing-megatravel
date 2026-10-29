import { Sparkles } from 'lucide-react'
import type { Promotion } from '@/lib/types'
import { normalize, titleCase } from '@/lib/catalog'
import './promotion-labels.css'

export function PromotionLabels({ promotions }: { promotions: Promotion[] }) {
  if (!promotions.length) return null
  return <div className="card-promotions">{promotions.map(promotion => {
    const newYear = [promotion.id, promotion.name, promotion.label].some(value => /\bano[\s_-]+nuevo\b/.test(normalize(value)))
    return <span className={`promo-label${newYear ? ' promo-label-new-year' : ''}`} key={promotion.id}>
      {newYear && <span className="promo-ticket-icon"><Sparkles size={15} aria-hidden="true"/></span>}
      <span className={newYear ? 'promo-ticket-text' : undefined}>{titleCase(promotion.label)}</span>
    </span>
  })}</div>
}
