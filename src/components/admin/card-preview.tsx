"use client";
import { useFormFields } from "@payloadcms/ui";
import { useEffect, useMemo, useState } from "react";
import { retirementAt, isActivePeriod } from "@/lib/lifecycle";
import { formatDate, formatMoney, titleCase } from "@/lib/catalog";
import { DEFAULT_FLYER } from "@/lib/flyer";
import { DEFAULT_CONTACT_URL } from "@/lib/brand-config";
import {
  DEFAULT_SEATS_VALIDITY_HOURS,
  prepareDateLastSeats,
  publicAvailability,
} from "@/lib/availability";
import {
  LastSeatsBadge,
  SeatAvailability,
  useSeatAvailability,
} from "../seat-availability";
import { PromotionLabels } from "../promotion-labels";
import { durationLabel } from "../new-badge";
import { newBadgeTextSize, programBadgeSnapshot, publicNewBadge } from "@/lib/new-badge";
import type { Promotion } from "@/lib/types";
const previewKeys = [
  "programRef",
  "program",
  "mtpe",
  "origin",
  "travelDate",
  "days",
  "nights",
  "price",
  "currency",
  "priceCondition",
  "flyerSourceUrl",
  "flyer",
  "availableSeats",
  "lastSeats",
  "seatsCheckedAt",
  "lastSeatsCheckedAt",
  "seatsConfirmed",
  "promotions",
  "newBadge",
  "newBadgeLabel",
  "newBadgeUntil",
];
export function CardPreview() {
  const { formValues, initialValues } = useFormFields(([fields]) => ({
    formValues: Object.fromEntries(
      previewKeys.map((key) => [key, fields[key]?.value]),
    ),
    initialValues: Object.fromEntries(
      previewKeys.map((key) => [key, fields[key]?.initialValue]),
    ),
  }));
  const [settings, setSettings] = useState({
    validityHours: DEFAULT_SEATS_VALIDITY_HOURS,
    contactUrl: DEFAULT_CONTACT_URL,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin-tools/availability-settings", {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const promotionIDs = (
    Array.isArray(formValues.promotions) ? formValues.promotions : []
  )
    .map((value) => (typeof value === "object" && value ? value.id : value))
    .filter(Boolean)
    .map(String)
    .join(",");
  useEffect(() => {
    setPromotions([]);
    if (!promotionIDs) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      "where[id][in]": promotionIDs,
      depth: "0",
      limit: String(promotionIDs.split(",").length),
    });
    fetch(`/api/campaigns?${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.docs)
          setPromotions(
            data.docs
              .filter((p: Promotion) => isActivePeriod(p))
              .map(
                (p: { id: string | number; name: string; label: string }) => ({
                  id: String(p.id),
                  name: p.name,
                  label: p.label,
                }),
              ),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [promotionIDs]);
  const [shared, setShared] = useState<Record<string, any> | null>(null);
  const ref = formValues.programRef as
    string | number | { id: string | number } | null;
  const id = ref && typeof ref === "object" ? ref.id : ref;
  useEffect(() => {
    setShared(null);
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/programs/${id}?depth=1`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setShared)
      .catch(() => {});
    return () => controller.abort();
  }, [id]);
  const reference = useMemo(() => {
    if (!shared) return null;
    return publicAvailability(
      {
        ...prepareDateLastSeats(
          formValues,
          initialValues.travelDate ? initialValues : undefined,
        ),
        availableSeats: shared.availableSeats,
        seatsCheckedAt: shared.seatsCheckedAt,
        programLastSeats: shared.lastSeats === true,
      },
      settings.validityHours,
    );
  }, [
    shared,
    formValues.lastSeats,
    formValues.seatsConfirmed,
    formValues.programRef,
    initialValues.lastSeats,
    initialValues.lastSeatsCheckedAt,
    initialValues.programRef,
    settings.validityHours,
  ]);
  const availability = useSeatAvailability(reference);
  const values = {
    ...formValues,
    ...(shared
      ? Object.fromEntries(
          ["program", "mtpe", "days", "nights", "flyerSourceUrl"].map((key) => [
            key,
            shared[key],
          ]),
        )
      : {}),
  };
  const [uploadedUrl, setUploadedUrl] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setUploadedUrl("");
    if (values.flyer)
      fetch(`/api/media/${values.flyer}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((doc) => {
          if (doc?.url) setUploadedUrl(doc.url);
        })
        .catch(() => {});
    return () => controller.abort();
  }, [values.flyer]);
  let date = "Fecha pendiente";
  try {
    retirementAt(String(values.travelDate), 0);
    date = formatDate(String(values.travelDate));
  } catch {}
  const imageUrl =
    (shared ? shared.flyer?.url : uploadedUrl) ||
    String(values.flyerSourceUrl || "") ||
    DEFAULT_FLYER;
  const newBadge = publicNewBadge({
    newBadge: formValues.newBadge === true,
    newBadgeLabel: formValues.newBadgeLabel ? String(formValues.newBadgeLabel) : null,
    newBadgeUntil: formValues.newBadgeUntil ? String(formValues.newBadgeUntil) : null,
    ...(shared ? programBadgeSnapshot(shared) : {}),
  });
  const days = Number(values.days || 0);
  const nights =
    values.nights == null || values.nights === "" ? null : Number(values.nights);
  return (
    <section
      className="mt-card-preview"
      aria-label="Vista previa de la tarjeta"
    >
      <h3>Vista previa antes de publicar</h3>
      <p>
        El saldo de cupos se comparte con el programa. Aquí puedes revisar la
        etiqueta individual de esta fecha antes de guardar.
      </p>
      <div className="mt-preview-card">
        <figure className="mt-preview-media">
          <img
            src={imageUrl}
            alt={`Imagen de ${values.program || "programa"}`}
            width="600"
            height="600"
            onError={(e) => {
              if (e.currentTarget.getAttribute("src") !== DEFAULT_FLYER)
                e.currentTarget.src = DEFAULT_FLYER;
            }}
          />
          {newBadge && (
            <span className="mt-preview-new" title={newBadge.label} data-text-size={newBadgeTextSize(newBadge.label)}>
              {newBadge.label}
            </span>
          )}
        </figure>
        <div className="mt-preview-duration-bridge">
          <span className="mt-preview-duration">
            {durationLabel(days, nights)}
          </span>
        </div>
        {availability?.lastSeats && (
          <LastSeatsBadge seats={availability.seats} />
        )}
        <div>
          <small>MTPE {String(values.mtpe || "")}</small>
          <PromotionLabels promotions={promotions} />
          <h4>{titleCase(String(values.program || "Nombre del programa"))}</h4>
          <p className="mt-preview-departure">
            <b>SALIDA:</b> {date}
          </p>
          <SeatAvailability
            availability={availability}
            bookingUrl=""
            contactUrl={settings.contactUrl}
            preview
            showQuantity={!availability?.lastSeats}
          />
          <strong>
            {formatMoney(
              Number(values.price || 0),
              String(values.currency || "USD"),
            )}
          </strong>
          <p>{String(values.priceCondition || "")}</p>
          <span className="mt-fake-button">Reservar en Meganet ↗</span>
        </div>
      </div>
    </section>
  );
}
