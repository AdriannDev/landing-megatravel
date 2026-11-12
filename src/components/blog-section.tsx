'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { BlogPost } from '@/lib/types'
import './blog-section.css'

export function BlogSection({ posts }: { posts: BlogPost[] }) {
  const visiblePosts = posts.slice(0, 6)
  const trackRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ first: 0, last: 0, start: true, end: true })

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const update = () => {
      const cards = Array.from(track.children) as HTMLElement[]
      const firstLeft = cards[0]?.offsetLeft ?? 0
      const visible = cards.flatMap((card, index) => {
        const left = card.offsetLeft - firstLeft - track.scrollLeft
        return left < track.clientWidth - 2 && left + card.offsetWidth > 2 ? [index] : []
      })
      setRange({ first: (visible[0] ?? 0) + 1, last: (visible.at(-1) ?? 0) + 1, start: track.scrollLeft <= 2, end: track.scrollLeft >= track.scrollWidth - track.clientWidth - 2 })
    }
    const observer = new ResizeObserver(update)
    observer.observe(track)
    track.addEventListener('scroll', update, { passive: true })
    update()
    return () => { observer.disconnect(); track.removeEventListener('scroll', update) }
  }, [posts])

  const navigate = (direction: -1 | 1) => {
    const track = trackRef.current
    const first = track?.firstElementChild as HTMLElement | null
    if (!track || !first) return
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
    const step = first.offsetWidth + gap
    const count = Math.max(1, Math.round((track.clientWidth + gap) / step))
    const index = Math.round(track.scrollLeft / step) + direction * count
    track.scrollTo({ left: Math.max(0, index * step), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  if (!visiblePosts.length) return null
  const firstVisible = range.first || 1
  const lastVisible = range.last || Math.min(3, visiblePosts.length)

  return (
    <section className="blog-section container" aria-labelledby="megablog-title" aria-roledescription="carrusel">
      <div className="blog-section-heading">
        <div>
          <span className="eyebrow">MEGA BLOG</span>
          <h2 id="megablog-title">Ideas que inspiran mejores viajes</h2>
          <p>Conoce las novedades, destinos y oportunidades que Mega Travel tiene para tus pasajeros.</p>
        </div>
        <a href="https://www.megatravel.pe/es/blog" target="_blank" rel="noopener noreferrer">
          Ver todos los artículos <ArrowUpRight size={16} aria-hidden="true" />
          <span className="sr-only">, abre otra pestaña</span>
        </a>
      </div>
      <div className="blog-carousel-toolbar">
        <span className="blog-carousel-status" role="status" aria-live="polite" aria-atomic="true">
          {firstVisible === lastVisible ? `Artículo ${firstVisible}` : `Artículos ${firstVisible}–${lastVisible}`} de {visiblePosts.length}
        </span>
        <div className="blog-carousel-controls">
          <button type="button" aria-label="Ver artículos anteriores" aria-controls="megablog-track" disabled={range.start} onClick={() => navigate(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" aria-label="Ver artículos siguientes" aria-controls="megablog-track" disabled={range.end} onClick={() => navigate(1)}><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
      </div>
      <div
        className="blog-card-grid"
        id="megablog-track"
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label="Artículos de Mega Blog. Usa las flechas izquierda y derecha para navegar."
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigate(event.key === 'ArrowLeft' ? -1 : 1) }
        }}
      >
        {visiblePosts.map((post, index) => (
          <article className="blog-card" key={post.sourceId} role="group" aria-roledescription="diapositiva" aria-label={`${index + 1} de ${visiblePosts.length}`}>
            <a href={post.href} target="_blank" rel="noopener noreferrer" aria-label={`${post.title}, abre el artículo en otra pestaña`}>
              <div className="blog-card-image">
                <img src={post.imageUrl} alt="" loading="lazy" decoding="async" width="960" height="600" />
              </div>
              <div className="blog-card-body">
                <div className="blog-card-meta">
                  <span>{post.category}</span>
                  {post.dateLabel && <time><CalendarDays size={14} aria-hidden="true" />{post.dateLabel}</time>}
                </div>
                <h3>{post.title}</h3>
                <span className="blog-card-link">Leer artículo <ArrowUpRight size={15} aria-hidden="true" /></span>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
