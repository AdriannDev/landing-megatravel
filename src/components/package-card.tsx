"use client";
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  FileText,
  Plane,
} from "lucide-react";
import { useState } from "react";
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

export function PackageCard({
  item,
  preview = false,
  contactUrl = DEFAULT_CONTACT_URL,
}: {
  item: PublicPackage;
  preview?: boolean;
  contactUrl?: string;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const availability = useSeatAvailability(item.availability);
  const imageUrl =
    item.flyerUrl && failedUrl !== item.flyerUrl
      ? item.flyerUrl
      : DEFAULT_FLYER;
  return (
    <article className="package-card">
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
              track("description_click", {
                package_id: item.id,
                mtpe: item.mtpe,
              })
            }
          >
            <FileText size={14} />
            Ver descriptivo
            <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </article>
  );
}
