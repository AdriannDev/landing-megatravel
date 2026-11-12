"use client";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import type { Banner, BannerPlacement } from "@/lib/types";
import { popupTimeRemaining } from "@/lib/popup";
import "./campaign-banner.css";

function GridEndBannerCard({
  banner,
  variant,
  reduced,
}: {
  banner: Banner;
  variant: "full" | "rectangular" | "square";
  reduced: boolean;
}) {
  const deadline = banner.countdownEndsAt || banner.endsAt || null;
  const wantCountdown = Boolean(banner.countdownEnabled && deadline);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!wantCountdown || !deadline || !Number.isFinite(Date.parse(deadline)))
      return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [wantCountdown, deadline]);

  const remaining =
    wantCountdown && now !== null ? popupTimeRemaining(deadline, now) : null;
  const hasOverlay = Boolean(
    remaining ||
      banner.popupLabel?.trim() ||
      banner.title?.trim() ||
      (banner.href && banner.buttonLabel?.trim() && wantCountdown),
  );

  const staticImage = banner.staticUrl || banner.imageUrl;
  const mobileStatic =
    banner.mobileUrl && !/\.gif(?:[?#]|$)/i.test(banner.mobileUrl)
      ? banner.mobileUrl
      : staticImage;

  const media = (
    <picture className="grid-end-banner-media">
      <source
        media="(max-width: 760px) and (prefers-reduced-motion: reduce)"
        srcSet={mobileStatic}
      />
      <source media="(prefers-reduced-motion: reduce)" srcSet={staticImage} />
      {banner.mobileUrl && (
        <source
          media="(max-width: 760px)"
          srcSet={reduced ? mobileStatic : banner.mobileUrl}
        />
      )}
      <img
        src={reduced ? staticImage : banner.imageUrl}
        alt={banner.alt}
        loading="lazy"
      />
    </picture>
  );

  const overlay = hasOverlay ? (
    <div className="grid-end-banner-overlay">
      <div className="grid-end-banner-frame">
        {banner.popupLabel?.trim() && (
          <span className="grid-end-banner-eyebrow">{banner.popupLabel}</span>
        )}
        {banner.title?.trim() && (
          <h3 className="grid-end-banner-title">{banner.title}</h3>
        )}
        {remaining && (
          <div
            className="grid-end-countdown"
            role="timer"
            aria-live="off"
            aria-label={`${remaining.days} días, ${remaining.hours} horas, ${remaining.minutes} minutos, ${remaining.seconds} segundos`}
          >
            {[
              { value: remaining.days, label: "DÍAS" },
              { value: remaining.hours, label: "HRS" },
              { value: remaining.minutes, label: "MINS" },
              { value: remaining.seconds, label: "SEGS" },
            ].map((unit) => (
              <div
                className="grid-end-countdown-box"
                key={unit.label}
                aria-hidden="true"
              >
                <span className="grid-end-countdown-value">
                  {String(unit.value).padStart(2, "0")}
                </span>
                <span className="grid-end-countdown-label">{unit.label}</span>
              </div>
            ))}
          </div>
        )}
        {banner.href && (
          <span className="grid-end-banner-cta">
            {banner.buttonLabel?.trim() || "Ver programa"}{" "}
            <ChevronRight size={14} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  ) : null;

  const content = (
    <>
      {media}
      {overlay}
    </>
  );

  return (
    <article
      className={`grid-end-banner-card grid-end-banner-${variant}${hasOverlay ? " has-overlay" : ""}${banner.countdownEnabled ? " has-countdown" : ""}`}
    >
      {banner.href ? (
        <a
          className="grid-end-banner-link"
          href={banner.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${banner.title || banner.alt}, abre otra pestaña`}
        >
          {content}
        </a>
      ) : (
        <div className="grid-end-banner-link">{content}</div>
      )}
    </article>
  );
}

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
  const autoRotate =
    placement === "hero" || placement === "between-results";
  const hasControls = placement === "hero" && count > 1;
  const playing =
    ready &&
    autoRotate &&
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

  if (placement === "catalog-end") {
    const items = banners.slice(0, 2);
    const single = items.length === 1;
    return (
      <section
        className={`catalog-end-banners${single ? " is-single" : " is-pair"}`}
        aria-label="Promociones destacadas del catálogo"
      >
        {items.map((item, idx) => (
          <GridEndBannerCard
            key={item.id}
            banner={item}
            variant={single ? "full" : idx === 0 ? "rectangular" : "square"}
            reduced={reduced}
          />
        ))}
      </section>
    );
  }

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
  const staticImage = banner.staticUrl || banner.imageUrl;
  const mobileStatic =
    banner.mobileUrl && !/\.gif(?:[?#]|$)/i.test(banner.mobileUrl)
      ? banner.mobileUrl
      : staticImage;
  const picture = (
    <picture key={banner.id}>
      <source
        media="(max-width: 760px) and (prefers-reduced-motion: reduce)"
        srcSet={mobileStatic}
        width="800"
        height={placement === "between-results" ? "160" : "800"}
      />
      <source
        media="(prefers-reduced-motion: reduce)"
        srcSet={staticImage}
      />
      {banner.mobileUrl && (
        <source
          media="(max-width: 760px)"
          srcSet={staticArt ? mobileStatic : banner.mobileUrl}
          width="800"
          height={placement === "between-results" ? "160" : "800"}
        />
      )}
      <img
        src={staticArt ? staticImage : banner.imageUrl}
        alt={banner.alt}
        width={placement === "between-results" ? "1200" : "1600"}
        height={placement === "between-results" ? "70" : "300"}
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
      onPointerEnter={placement === "hero" ? (e) => pauseForInteraction(e.target) : undefined}
      onTouchStart={placement === "hero" ? (e) => pauseForInteraction(e.target) : undefined}
      onFocusCapture={placement === "hero" ? (e) => pauseForInteraction(e.target) : undefined}
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
      {hasControls && (
        <div className="banner-controls">
          <button
            className="banner-arrow banner-previous"
            type="button"
            aria-label="Banner anterior"
            onClick={() => navigate(current - 1)}
          >
            <ChevronLeft size={21} aria-hidden="true" />
          </button>
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
