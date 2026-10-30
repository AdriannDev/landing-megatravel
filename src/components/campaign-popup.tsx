"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Megaphone, Newspaper } from "lucide-react";
import type { Banner } from "@/lib/types";
import { isActivePeriod } from "@/lib/lifecycle";
import {
  popupStorageKey,
  popupTimeRemaining,
  shouldShowPopup,
} from "@/lib/popup";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export function CampaignPopup({ banner }: { banner: Banner }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const shown = useRef(false);
  const { id, startsAt, endsAt, popupDelay, popupFrequency } = banner;
  useEffect(() => {
    if (shown.current) return;
    const key = popupStorageKey({ id, startsAt } as Banner);
    const storage = () =>
      popupFrequency === "daily" ? window.localStorage : window.sessionStorage;
    try {
      if (!shouldShowPopup(popupFrequency, storage().getItem(key))) return;
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    let retry: ReturnType<typeof setTimeout>;
    const show = () => {
      if (!isActivePeriod({ startsAt, endsAt })) return;
      if (
        document.visibilityState !== "visible" ||
        document.querySelector('[role="dialog"]')
      ) {
        retry = setTimeout(show, 1000);
        return;
      }
      shown.current = true;
      try {
        storage().setItem(key, String(Date.now()));
      } catch {
        /* Still show once in this mounted catalog. */
      }
      setOpen(true);
    };
    const timer = setTimeout(
      show,
      Math.max(0, Math.min(60, popupDelay ?? 2)) * 1000,
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(retry);
    };
  }, [id, startsAt, endsAt, popupDelay, popupFrequency]);
  useEffect(() => {
    if (!open || !endsAt || !Number.isFinite(Date.parse(endsAt))) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (!isActivePeriod({ startsAt, endsAt }, new Date(time))) setOpen(false);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, startsAt, endsAt]);
  const news = banner.popupKind === "news";
  const Icon = news ? Newspaper : Megaphone;
  const remaining =
    !news && now !== null ? popupTimeRemaining(endsAt, now) : null;
  const units = remaining
    ? [
        ...(remaining.days > 0
          ? [{ value: remaining.days, label: "Días" }]
          : []),
        { value: remaining.hours, label: "Horas" },
        { value: remaining.minutes, label: "Minutos" },
        { value: remaining.seconds, label: "Segundos" },
      ]
    : [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={`campaign-popup${banner.imageUrl ? " campaign-popup-with-image" : ""}`}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document
            .querySelector<HTMLButtonElement>(".campaign-popup .dialog-close")
            ?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document
            .querySelector<HTMLInputElement>(".main-search input")
            ?.focus({ preventScroll: true });
        }}
      >
        {banner.imageUrl && (
          <picture className="popup-art">
            <source
              media="(prefers-reduced-motion: reduce)"
              srcSet={banner.staticUrl || banner.imageUrl}
            />
            {banner.mobileUrl && (
              <source media="(max-width: 760px)" srcSet={banner.mobileUrl} />
            )}
            <img
              src={banner.imageUrl}
              alt={banner.alt}
              width="1200"
              height="900"
            />
          </picture>
        )}
        <div className="popup-copy">
          <span className="popup-eyebrow">
            <Icon size={14} aria-hidden="true" />
            {news ? "Noticias Megatravel" : "Especial para tu agencia"}
          </span>
          <DialogTitle>{banner.title || banner.alt}</DialogTitle>
          <DialogDescription
            className={banner.message ? "popup-message" : "sr-only"}
          >
            {banner.message ||
              "Descubre las novedades de Megatravel para agencias de viajes."}
          </DialogDescription>
          {remaining && (
            <div className="popup-countdown">
              <p>Esta promoción termina en</p>
              <div
                className="popup-clock"
                role="timer"
                aria-live="off"
                aria-label={units
                  .map((unit) => `${unit.value} ${unit.label.toLowerCase()}`)
                  .join(", ")}
              >
                {units.map((unit) => (
                  <div
                    className="popup-clock-unit"
                    key={unit.label}
                    aria-hidden="true"
                  >
                    <span className="popup-clock-value">
                      {String(unit.value).padStart(2, "0")}
                    </span>
                    <span className="popup-clock-label">{unit.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="popup-actions">
            {banner.href && (
              <a
                className="button button-primary"
                href={banner.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                {banner.buttonLabel || "Conocer más"}
                <ArrowUpRight size={17} />
                <span className="sr-only"> (abre otra pestaña)</span>
              </a>
            )}
            <DialogClose className="popup-dismiss">
              Seguir explorando
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
