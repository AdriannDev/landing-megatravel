"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Banner, BannerPlacement } from "@/lib/types";

export function CampaignBanner({
  banners,
  placement = "hero",
}: {
  banners: Banner[];
  placement?: BannerPlacement;
}) {
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false),
    [hidden, setHidden] = useState(false),
    [ready, setReady] = useState(false);
  const count = banners.length,
    current = count ? index % count : 0;
  const playing =
    ready &&
    placement === "hero" &&
    count > 1 &&
    !paused &&
    !reduced &&
    !hidden;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(preference.matches);
    const visibility = () => setHidden(document.visibilityState !== "visible");
    motion();
    visibility();
    setReady(true);
    preference.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      preference.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [playing, count]);
  if (!count) return null;
  const banner = banners[current];
  const navigate = (next: number) => {
    setPaused(true);
    setIndex((next + count) % count);
  };
  const pauseForInteraction = (target: EventTarget) => {
    // The playback button handles its own intent, including when its icon changes under the pointer.
    if (!(target instanceof Element) || !target.closest("[data-playback]"))
      setPaused(true);
  };
  const staticArt = reduced || paused || hidden;
  const mobileStatic =
    banner.mobileUrl && !/\.gif(?:[?#]|$)/i.test(banner.mobileUrl)
      ? banner.mobileUrl
      : banner.staticUrl;
  const picture = (
    <picture key={banner.id}>
      <source
        media="(max-width: 640px) and (prefers-reduced-motion: reduce)"
        srcSet={mobileStatic}
        width="800"
        height="800"
      />
      <source
        media="(prefers-reduced-motion: reduce)"
        srcSet={banner.staticUrl}
      />
      {banner.mobileUrl && (
        <source
          media="(max-width: 640px)"
          srcSet={staticArt ? mobileStatic : banner.mobileUrl}
          width="800"
          height="800"
        />
      )}
      <img
        src={staticArt ? banner.staticUrl : banner.imageUrl}
        alt={banner.alt}
        width="1600"
        height="600"
        loading={placement === "hero" ? "eager" : "lazy"}
        fetchPriority={placement === "hero" ? "high" : "low"}
      />
    </picture>
  );
  return (
    <section
      className={`campaign-banner banner-${placement}`}
      aria-roledescription="carrusel"
      aria-label={
        placement === "hero"
          ? "Campañas de Megatravel"
          : placement === "between-results"
            ? "Promociones entre resultados"
            : "Promociones del final del catálogo"
      }
      onPointerEnter={(e) => pauseForInteraction(e.target)}
      onTouchStart={(e) => pauseForInteraction(e.target)}
      onFocusCapture={(e) => pauseForInteraction(e.target)}
    >
      <div
        aria-live={playing ? "off" : "polite"}
        aria-atomic="true"
        className="banner-slide"
        role="group"
        aria-roledescription="diapositiva"
        aria-label={`${current + 1} de ${count}`}
      >
        {banner.href ? (
          <a
            href={banner.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${banner.alt}, abre otra pestaña`}
          >
            {picture}
          </a>
        ) : (
          picture
        )}
      </div>
      {count > 1 && (
        <div className="banner-controls">
          <button
            className="banner-arrow banner-previous"
            type="button"
            aria-label="Banner anterior"
            onClick={() => navigate(current - 1)}
          >
            <ChevronLeft size={21} aria-hidden="true" />
          </button>
          <div className="banner-indicators">
            {banners.map((item, i) => (
              <button
                type="button"
                key={item.id}
                aria-label={`Ir al banner ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => navigate(i)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            className="banner-arrow banner-next"
            type="button"
            aria-label="Banner siguiente"
            onClick={() => navigate(current + 1)}
          >
            <ChevronRight size={21} aria-hidden="true" />
          </button>
          {placement === "hero" && (
            <button
              className="banner-playback"
              type="button"
              data-playback
              aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"}
              aria-pressed={paused}
              disabled={reduced}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? (
                <Play size={17} aria-hidden="true" />
              ) : (
                <Pause size={17} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
