export const DEFAULT_SEATS_VALIDITY_HOURS = 72;
export const MAX_SEATS_VALIDITY_HOURS = 720;
const HOUR_MS = 3600000;

export type SeatReference = {
  availableSeats?: number | null;
  lastSeats?: boolean | null;
  seatsCheckedAt?: string | null;
  programLastSeats?: boolean | null;
  lastSeatsCheckedAt?: string | null;
};
export type PublicAvailability = {
  seats: number | null;
  lastSeats: boolean;
  expiresAt: string;
  seatsExpiresAt?: string | null;
  lastSeatsExpiresAt?: string | null;
};
export const validSeatCount = (value: unknown) =>
  value == null ||
  value === "" ||
  (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
export const seatsValidityHours = (value: unknown) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_SEATS_VALIDITY_HOURS
    ? value
    : DEFAULT_SEATS_VALIDITY_HOURS;
export const hasSeatReference = (item: SeatReference) =>
  item.availableSeats != null ||
  item.lastSeats === true ||
  item.programLastSeats === true;

export function seatReferenceExpiry(
  item: SeatReference,
  hours = DEFAULT_SEATS_VALIDITY_HOURS,
) {
  const checked = Date.parse(item.seatsCheckedAt || "");
  return Number.isFinite(checked)
    ? checked + seatsValidityHours(hours) * HOUR_MS
    : NaN;
}
export function seatReviewState(
  item: SeatReference,
  hours = DEFAULT_SEATS_VALIDITY_HOURS,
  now = Date.now(),
): "missing" | "current" | "stale" {
  if (!hasSeatReference(item)) return "missing";
  if ("programLastSeats" in item || "lastSeatsCheckedAt" in item) {
    const stamps = [
      ...(item.availableSeats != null || item.programLastSeats
        ? [item.seatsCheckedAt]
        : []),
      ...(item.lastSeats ? [item.lastSeatsCheckedAt] : []),
    ];
    return stamps.some((stamp) => {
      const time = Date.parse(stamp || "");
      return (
        !Number.isFinite(time) ||
        time > now ||
        time + seatsValidityHours(hours) * HOUR_MS <= now
      );
    })
      ? "stale"
      : "current";
  }
  const checked = Date.parse(item.seatsCheckedAt || "");
  return checked <= now && seatReferenceExpiry(item, hours) > now
    ? "current"
    : "stale";
}
export function publicAvailability(
  item: SeatReference,
  hours = DEFAULT_SEATS_VALIDITY_HOURS,
  now = Date.now(),
): PublicAvailability | null {
  if ("programLastSeats" in item || "lastSeatsCheckedAt" in item) {
    if (!validSeatCount(item.availableSeats) || item.availableSeats === 0)
      return null;
    const expiry = (stamp: string | null | undefined) => {
      const checked = Date.parse(stamp || "");
      return Number.isFinite(checked) &&
        checked <= now &&
        checked + seatsValidityHours(hours) * HOUR_MS > now
        ? checked + seatsValidityHours(hours) * HOUR_MS
        : 0;
    };
    const programExpiry = expiry(item.seatsCheckedAt);
    const seatsExpiry = item.availableSeats != null ? programExpiry : 0;
    const lastExpiry = Math.max(
      item.programLastSeats ? programExpiry : 0,
      item.lastSeats ? expiry(item.lastSeatsCheckedAt) : 0,
    );
    if (!seatsExpiry && !lastExpiry) return null;
    return {
      seats: seatsExpiry ? (item.availableSeats ?? null) : null,
      lastSeats: !!lastExpiry,
      expiresAt: new Date(Math.max(seatsExpiry, lastExpiry)).toISOString(),
      seatsExpiresAt: seatsExpiry ? new Date(seatsExpiry).toISOString() : null,
      lastSeatsExpiresAt: lastExpiry
        ? new Date(lastExpiry).toISOString()
        : null,
    };
  }
  if (
    !validSeatCount(item.availableSeats) ||
    item.availableSeats === 0 ||
    seatReviewState(item, hours, now) !== "current"
  )
    return null;
  return {
    seats: item.availableSeats ?? null,
    lastSeats: item.lastSeats === true,
    expiresAt: new Date(seatReferenceExpiry(item, hours)).toISOString(),
  };
}
export function visibleAvailability(
  value: PublicAvailability | null | undefined,
  now = Date.now(),
) {
  if (!value || Date.parse(value.expiresAt) <= now) return null;
  if ("seatsExpiresAt" in value || "lastSeatsExpiresAt" in value) {
    const seats =
      value.seatsExpiresAt && Date.parse(value.seatsExpiresAt) > now
        ? value.seats
        : null;
    const lastSeats =
      !!value.lastSeatsExpiresAt &&
      Date.parse(value.lastSeatsExpiresAt) > now &&
      value.lastSeats;
    return seats != null || lastSeats ? { ...value, seats, lastSeats } : null;
  }
  return value;
}

// A date owns only its urgency flag; the program owns the shared quantity.
export function prepareDateLastSeats(
  data: SeatEdit,
  original?: SeatEdit & { lastSeatsCheckedAt?: string | null },
  now = Date.now(),
) {
  const changedProgram =
    original &&
    "programRef" in data &&
    relation(data.programRef) !== relation(original.programRef);
  const lastSeats =
    !changedProgram && (data.lastSeats ?? original?.lastSeats) === true;
  const stamp =
    lastSeats && (data.seatsConfirmed === true || !original?.lastSeats)
      ? new Date(now).toISOString()
      : (original?.lastSeatsCheckedAt ?? null);
  return {
    lastSeats,
    lastSeatsCheckedAt: lastSeats ? stamp : null,
    seatsConfirmed: false,
  };
}

type SeatEdit = SeatReference & {
  seatsConfirmed?: boolean;
  travelDate?: unknown;
  origin?: unknown;
  programRef?: unknown;
};
const relation = (value: unknown) =>
  value && typeof value === "object" && "id" in value
    ? String(value.id)
    : value == null
      ? null
      : String(value);

// The review timestamp is always server-owned. Unrelated edits never renew it.
export function prepareSeatReference(
  data: SeatEdit,
  original?: SeatEdit,
  now = Date.now(),
): Required<
  Pick<SeatReference, "availableSeats" | "lastSeats" | "seatsCheckedAt">
> & { seatsConfirmed: false } {
  const combined = { ...original, ...data };
  if (!validSeatCount(combined.availableSeats))
    throw new Error(
      "Indica una cantidad de sillas entera, mayor o igual que cero, o deja el campo vacío.",
    );
  const seats =
    combined.availableSeats == null ||
    (combined.availableSeats as unknown) === ""
      ? null
      : combined.availableSeats;
  const lastSeats = seats !== 0 && combined.lastSeats === true;
  const identityChanged =
    original &&
    (["travelDate", "origin", "programRef"] as const).some(
      (key) => key in data && relation(data[key]) !== relation(original[key]),
    );
  if (identityChanged)
    return {
      availableSeats: null,
      lastSeats: false,
      seatsCheckedAt: null,
      seatsConfirmed: false,
    };
  const changed =
    seats !== (original?.availableSeats ?? null) ||
    lastSeats !== (original?.lastSeats === true);
  const checked =
    changed || data.seatsConfirmed === true
      ? new Date(now).toISOString()
      : (original?.seatsCheckedAt ?? null);
  return {
    availableSeats: seats,
    lastSeats,
    seatsCheckedAt: hasSeatReference({ availableSeats: seats, lastSeats })
      ? checked
      : null,
    seatsConfirmed: false,
  };
}
