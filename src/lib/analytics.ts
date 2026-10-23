'use client'
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }
export function track(event: 'booking_click' | 'description_click' | 'search_no_results', data: Record<string, string | number>) {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GA4_ID) window.gtag?.('event', event, data)
}
