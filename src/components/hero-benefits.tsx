"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, MoveHorizontal } from "lucide-react";

const benefits = [
  { icon: "ready", text: "Respuesta rápida y viajes armados" },
  { icon: "earnings", text: "Más ganancias con High Ticket" },
  { icon: "media", text: "Material audiovisual gratis" },
  { icon: "training", text: "Capacitaciones para vender más" },
  { icon: "trip", text: "Oportunidad de Fam Trip gratis" },
] as const;

function BenefitIcon({ kind }: { kind: (typeof benefits)[number]["icon"] }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "ready" && <>
        <path d="M17 28H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v7M10 10h7M10 15h4M10 20h3" />
        <circle cx="23" cy="22" r="7" />
        <path className="benefit-icon-accent" d="M23 18v4l2.5 1.5" />
      </>}
      {kind === "earnings" && <>
        <rect x="3" y="4" width="26" height="24" rx="3" />
        <path d="M3 10h26M7 7h.01M10 7h.01M8 23v-3M13 23v-6M18 23v-4M23 23v-8" />
        <path className="benefit-icon-accent" d="m8 17 6-4 5 2 6-6M21 9h4v4" />
      </>}
      {kind === "media" && <>
        <path d="M4 12h24v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V12ZM4 12 2.5 6.5a1 1 0 0 1 .7-1.2L25 2a1 1 0 0 1 1.2.7l1.5 5.5L4 12ZM10 4.3l3 6.1M19 2.9l3 6.1" />
        <path className="benefit-icon-accent" d="m13 17 7 4-7 4v-8Z" />
      </>}
      {kind === "training" && <>
        <rect x="3" y="4" width="26" height="18" rx="2" />
        <path d="M16 22v6M11 29l5-3 5 3M8 9h7M8 13h4" />
        <path className="benefit-icon-accent" d="m17 16 3-4 3 2 3-6" />
      </>}
      {kind === "trip" && <>
        <path d="M11 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M10 28v1M22 28v1" />
        <rect x="6" y="7" width="20" height="21" rx="3" />
        <path className="benefit-icon-accent" d="m11 20 10-7M17 13l4 .1-.7 4.4M11 17l3 1M15 23l1-4" />
      </>}
    </svg>
  );
}

export function HeroBenefits() {
  const listRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const media = matchMedia("(max-width: 760px) and (prefers-reduced-motion: no-preference)");
    const update = () => {
      setMotionAllowed(media.matches);
      if (!media.matches && listRef.current) listRef.current.scrollLeft = 0;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !motionAllowed || paused) return;
    let direction = 1;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.25 });
    observer.observe(list);
    const timer = setInterval(() => {
      if (!visible || document.hidden) return;
      const max = list.scrollWidth - list.clientWidth;
      if (max <= 0) return;
      const first = list.children[0] as HTMLElement;
      const points = [...new Set([0, ...Array.from(list.children, child => Math.min((child as HTMLElement).offsetLeft - first.offsetLeft, max)), max])];
      if (list.scrollLeft >= max - 2) direction = -1;
      if (list.scrollLeft <= 2) direction = 1;
      const next = direction === 1
        ? points.find(point => point > list.scrollLeft + 2)
        : points.filter(point => point < list.scrollLeft - 2).at(-1);
      if (next != null) list.scrollTo({ left: next, behavior: "smooth" });
    }, 4000);
    return () => { clearInterval(timer); observer.disconnect(); };
  }, [motionAllowed, paused]);

  return (
    <div className="hero-benefits-wrap">
      <ul
        ref={listRef}
        className="hero-benefits"
        aria-label="Beneficios para tu agencia"
        tabIndex={0}
        onPointerDown={() => setPaused(true)}
        onWheel={() => setPaused(true)}
        onFocus={() => setPaused(true)}
      >
        {benefits.map(({ icon, text }) => (
          <li key={icon}>
            <span className="hero-benefit-icon"><BenefitIcon kind={icon} /></span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="hero-benefits-tools">
        <span><MoveHorizontal size={13} aria-hidden="true" />Desliza para ver más</span>
        {motionAllowed && (
          <button
            type="button"
            onClick={() => setPaused(value => !value)}
            aria-label={paused ? "Reanudar movimiento de beneficios" : "Pausar movimiento de beneficios"}
          >
            {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            {paused ? "Reanudar" : "Pausar"}
          </button>
        )}
      </div>
    </div>
  );
}

