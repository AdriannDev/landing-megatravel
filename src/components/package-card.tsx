"use client";
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  FileText,
  Plane,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { PublicPackage } from "@/lib/types";
import { formatDate, formatMoney, titleCase } from "@/lib/catalog";
import { Button } from "./ui/button";
import { track } from "@/lib/analytics";
import { DEFAULT_FLYER } from "@/lib/flyer";
import { DEFAULT_CONTACT_URL } from "@/lib/brand-config";
import {
  LastSeatsBadge,
  SeatAvailability,
  useSeatAvailability,
} from "./seat-availability";
import { PromotionLabels } from "./promotion-labels";
import { NewBadge, durationLabel } from "./new-badge";
import "./package-card.css";

function PackageActions({ item, preview }: { item: PublicPackage; preview: boolean }) {
  return (
    <>
      {preview ? (
        <Button disabled>
          Reservar en Meganet <ArrowUpRight size={16} />
        </Button>
      ) : (
        <Button asChild>
          <a
            href={item.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Reservar ${item.program} en Meganet, abre otra pestaña`}
            onClick={() =>
              track("booking_click", {
                package_id: item.id,
                mtpe: item.mtpe,
                departure_date: item.travelDate,
              })
            }
          >
            Reservar en Meganet <ArrowUpRight size={16} />
          </a>
        </Button>
      )}
      {!preview && (
        <a
          className="description-link"
          href={item.descriptionUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver descriptivo de ${item.program}, abre otra pestaña`}
          onClick={() =>
            track("description_click", { package_id: item.id, mtpe: item.mtpe })
          }
        >
          <FileText size={14} />
          Ver descriptivo
          <ArrowUpRight size={13} />
        </a>
      )}
    </>
  );
}

export function PackageCard({
  item,
  preview = false,
  contactUrl = DEFAULT_CONTACT_URL,
  view = "grid",
}: {
  item: PublicPackage;
  preview?: boolean;
  contactUrl?: string;
  view?: "grid" | "list";
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const listCardRef = useRef<HTMLElement>(null);
  const listContentRef = useRef<HTMLDivElement>(null);
  const availability = useSeatAvailability(item.availability);
  const imageUrl =
    item.flyerUrl && failedUrl !== item.flyerUrl
      ? item.flyerUrl
      : DEFAULT_FLYER;
  useLayoutEffect(() => {
    const card = listCardRef.current;
    const content = listContentRef.current;
    if (view !== "list" || !card || !content || typeof ResizeObserver === "undefined") return;
    const media = card.querySelector<HTMLElement>(".list-media");
    if (!media) return;
    let frame = 0;
    let lastWidth = 0;
    let compact = false;
    const measure = () => {
      const width = card.clientWidth;
      if (Math.abs(width - lastWidth) > 1) {
        lastWidth = width;
        compact = false;
        card.classList.remove("list-compact");
      }
      if (compact || getComputedStyle(media).display === "none") return;
      const size = content.getBoundingClientRect().height;
      // En filas demasiado estrechas, mantener el detalle completo sin imagen.
      if (size > width * 0.43) {
        compact = true;
        card.classList.add("list-compact");
        return;
      }
      card.style.setProperty("--list-media-size", `${size}px`);
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(card);
    observer.observe(content);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [view]);
  if (view === "list") {
    return (
      <article className="package-card package-list-card" ref={listCardRef}>
        <div className="list-media">
          <img
            className="list-media-background"
            src={imageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setFailedUrl(item.flyerUrl)}
          />
          <img
            className="list-media-image"
            src={imageUrl}
            alt={`Imagen de ${titleCase(item.program)}, salida ${formatDate(item.travelDate)}`}
            loading="lazy"
            width="600"
            height="600"
            onError={() => setFailedUrl(item.flyerUrl)}
          />
          {item.newBadge && <NewBadge label={item.newBadge.label} />}
        </div>
        <div className="list-content" ref={listContentRef}>
          <div className="list-details">
            <div className="list-meta">
              <span className="region-label">{titleCase(item.zone)}</span>
              <span className="mtpe">MTPE {item.mtpe}</span>
              <span className="list-duration">{durationLabel(item.days, item.nights)}</span>
              {item.newBadge && <span className="list-mobile-new">{item.newBadge.label}</span>}
            </div>
            <h3>{titleCase(item.program)}</h3>
            <PromotionLabels promotions={item.promotions} />
            <div className="list-route">
              <span><MapPin size={14} aria-hidden="true" />{titleCase(item.destination)}</span>
              <span><Plane size={13} aria-hidden="true" />Desde {titleCase(item.origin)}</span>
            </div>
            <div className="list-departure">
              <CalendarDays size={15} aria-hidden="true" />
              <strong>Salida:</strong>
              <time dateTime={item.travelDate}>{formatDate(item.travelDate)}</time>
            </div>
            {availability?.lastSeats && <LastSeatsBadge seats={availability.seats} />}
            <SeatAvailability
              availability={availability}
              bookingUrl={item.bookingUrl}
              contactUrl={contactUrl}
              preview={preview}
              showQuantity={!availability?.lastSeats}
            />
          </div>
          <div className="list-actions">
            <div className="list-price">
              <div>
                <span className="price-from">Desde</span>
                <span className="price"><strong>{formatMoney(item.price, item.currency)}</strong></span>
              </div>
              <span className="list-price-condition">{item.priceCondition}</span>
            </div>
            <PackageActions item={item} preview={preview} />
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className="package-card">
      <div className="package-visual">
        <div className="flyer-image">
          <img
            src={imageUrl}
            alt={`Imagen de ${titleCase(item.program)}, salida ${formatDate(item.travelDate)}`}
            loading="lazy"
            width="600"
            height="600"
            onError={() => setFailedUrl(item.flyerUrl)}
          />
          {item.newBadge && <NewBadge label={item.newBadge.label} />}
        </div>
        <div className="duration-bridge">
          <span className="duration-pill">
            {durationLabel(item.days, item.nights)}
          </span>
        </div>
      </div>
      {availability?.lastSeats && <LastSeatsBadge seats={availability.seats} />}
      <div className="package-body">
        <div className="card-topline">
          <span className="region-label">{titleCase(item.zone)}</span>
          <span className="mtpe">MTPE {item.mtpe}</span>
        </div>
        <PromotionLabels promotions={item.promotions} />
        <h3>{titleCase(item.program)}</h3>
        <div className="route">
          <MapPin size={14} />
          <span>{titleCase(item.destination)}</span>
          <span className="route-origin">
            <Plane size={13} />
            Desde {titleCase(item.origin)}
          </span>
        </div>
        <div className="departure-meta">
          <span className="departure-date">
            <CalendarDays size={15} aria-hidden="true" />
            <span className="departure-label">Salida:</span>
            <time dateTime={item.travelDate}>
              {formatDate(item.travelDate)}
            </time>
          </span>
        </div>
        <SeatAvailability
          availability={availability}
          bookingUrl={item.bookingUrl}
          contactUrl={contactUrl}
          preview={preview}
          showQuantity={!availability?.lastSeats}
        />
        <div className="price-row">
          <div>
            <span className="price-from">Desde</span>
            <div className="price">
              <strong>{formatMoney(item.price, item.currency)}</strong>
            </div>
          </div>
          <span className="price-condition">{item.priceCondition}</span>
        </div>
        <PackageActions item={item} preview={preview} />
      </div>
    </article>
  );
}
