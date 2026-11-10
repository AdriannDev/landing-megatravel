"use client";
import { useEffect, useState } from "react";
import { Armchair, Flame } from "lucide-react";
import {
  visibleAvailability,
  type PublicAvailability,
} from "@/lib/availability";
import "./seat-availability.css";

export function useSeatAvailability(
  value: PublicAvailability | null | undefined,
) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const time = Date.now();
      setNow(time);
      const remaining = Math.min(...[value?.expiresAt, value?.seatsExpiresAt, value?.lastSeatsExpiresAt].map(stamp => Date.parse(stamp || '') - time).filter(ms => ms > 0));
      if (Number.isFinite(remaining) && remaining > 0)
        timer = setTimeout(update, Math.min(remaining, 2147483647));
    };
    update();
    return () => clearTimeout(timer);
  }, [value?.expiresAt, value?.seatsExpiresAt, value?.lastSeatsExpiresAt]);
  // First render matches the server. The effect checks expiry on hydration, too.
  return now === null ? (value ?? null) : visibleAvailability(value, now);
}

export function LastSeatsBadge({ seats }: { seats?: number | null }) {
  return (
    <div className="last-seats-badge">
      <span className="last-seats-icon">
        <Flame size={23} aria-hidden="true" />
      </span>
      <div className="last-seats-copy">
        <strong>¡Últimas sillas!</strong>
        <span>
          {seats != null
            ? `${seats} ${seats === 1 ? "silla disponible · sujeta" : "sillas disponibles · sujetas"} a confirmación`
            : "Disponibilidad limitada · sujeta a confirmación"}
        </span>
      </div>
    </div>
  );
}

export function SeatAvailability({
  availability,
  bookingUrl,
  contactUrl,
  preview = false,
  showQuantity = true,
}: {
  availability: PublicAvailability | null;
  bookingUrl: string;
  contactUrl: string;
  preview?: boolean;
  showQuantity?: boolean;
}) {
  const link = (href: string, label: string) =>
    preview || !href ? (
      <span>{label}</span>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <span className="sr-only"> (abre otra pestaña)</span>
      </a>
    );
  return (
    <div className="seat-availability">
      {showQuantity && availability?.seats != null && (
        <p className="seat-quantity">
          <Armchair size={17} aria-hidden="true" />
          <span>
            Disponibilidad:{" "}
            <strong>
              {availability.seats}{" "}
              {availability.seats === 1 ? "silla" : "sillas"}
            </strong>
          </span>
        </p>
      )}
      <p className="seat-confirmation">
        {availability
          ? "Disponibilidad sujeta a cambios. Confirma "
          : "Consulta disponibilidad "}
        {link(contactUrl, "con un asesor")}.
      </p>
    </div>
  );
}
