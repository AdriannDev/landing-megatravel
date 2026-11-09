import { ArrowUpRight, CalendarDays } from 'lucide-react'
import type { BlogPost } from '@/lib/types'
import './blog-section.css'

export function BlogSection({ posts }: { posts: BlogPost[] }) {
  const visiblePosts = posts.slice(0, 3)
  if (visiblePosts.length !== 3) return null

  return (
    <section className="blog-section container" aria-labelledby="megablog-title">
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
      <div className="blog-card-grid">
        {visiblePosts.map(post => (
          <article className="blog-card" key={post.sourceId}>
            <a href={post.href} target="_blank" rel="noopener noreferrer" aria-label={`${post.title}, abre el artículo en otra pestaña`}>
              <div className="blog-card-image">
                <img src={post.imageUrl} alt="" loading="lazy" width="720" height="450" />
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
