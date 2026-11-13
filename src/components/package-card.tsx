"use client";
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  FileText,
  Plane,
  Play,
} from "lucide-react";
import { useState } from "react";
import type { PublicPackage } from "@/lib/types";
import { formatDate, formatMoney, titleCase } from "@/lib/catalog";
import { Button } from "./ui/button";
import { track } from "@/lib/analytics";
import { DEFAULT_FLYER } from "@/lib/flyer";
import { DEFAULT_CONTACT_URL } from "@/lib/brand-config";
import { hasFlashSale } from "@/lib/promotions";
import {
  LastSeatsBadge,
  SeatAvailability,
  useSeatAvailability,
} from "./seat-availability";
import { PromotionLabels } from "./promotion-labels";
import { NewBadge, durationLabel } from "./new-badge";
import "./package-card.css";
import "./flash-sale.css";

function PackageRoute({ item, list = false }: { item: PublicPackage; list?: boolean }) {
  return (
    <div className={list ? "list-route" : "route"}>
      <span className="route-origin">
        <Plane size={13} aria-hidden="true" />
        Desde {titleCase(item.origin)}
      </span>
      <span className="route-destination">
        <MapPin size={14} aria-hidden="true" />
        {titleCase(item.destination)}
      </span>
    </div>
  );
}

function VideoLink({ item, compact = false }: { item: PublicPackage; compact?: boolean }) {
  if (!item.videoUrl) return null;
  return (
    <a
      className={compact ? "list-video-link" : "package-video-overlay"}
      href={item.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver video de ${titleCase(item.program)}, abre otra pestaña`}
    >
      <Play size={compact ? 15 : 18} fill={compact ? "currentColor" : "none"} strokeWidth={1.6} aria-hidden="true" />
      {compact && <span>Ver video</span>}
    </a>
  );
}

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
  const availability = useSeatAvailability(item.availability);
  const promotionClass = hasFlashSale(item.promotions) ? " package-card--flash-sale" : "";
  const imageUrl =
    item.flyerUrl && failedUrl !== item.flyerUrl
      ? item.flyerUrl
      : DEFAULT_FLYER;
  if (view === "list") {
    return (
      <article className={`package-card package-list-card${promotionClass}`}>
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
          <VideoLink item={item} />
        </div>
        <div className="list-content">
          <div className="list-details">
            <div className="list-meta">
              <span className="region-label">{titleCase(item.zone)}</span>
              <span className="mtpe">MTPE {item.mtpe}</span>
              <span className="list-duration">{durationLabel(item.days, item.nights)}</span>
              {item.newBadge && <span className="list-mobile-new">{item.newBadge.label}</span>}
            </div>
            <h3>{titleCase(item.program)}</h3>
            <VideoLink item={item} compact />
            <PromotionLabels promotions={item.promotions} />
            <PackageRoute item={item} list />
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
    <article className={`package-card${promotionClass}`}>
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
          <VideoLink item={item} />
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
        <PackageRoute item={item} />
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
