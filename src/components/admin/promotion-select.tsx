"use client";

import { useEffect, useState } from "react";

type Promotion = { id: string | number; name: string; label: string };

export function usePromotionOptions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin-tools/promotions", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "No se pudieron cargar las promociones. Recarga la página.",
          );
        return response.json();
      })
      .then((data) => setPromotions(data.promotions))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  return { promotions, error, loading };
}

export function PromotionSelect({
  promotions,
  loading,
  value,
  onChange,
  index,
}: {
  promotions: Promotion[];
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
  index: number;
}) {
  return (
    <label>
      Promoción {index + 1} (opcional)
      <select
        aria-label={`Promoción de salida ${index + 1}`}
        value={value}
        disabled={loading}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {loading ? "Cargando promociones…" : "Sin promoción"}
        </option>
        {promotions.map((promotion) => (
          <option key={promotion.id} value={promotion.id}>
            {promotion.name}
            {promotion.label !== promotion.name ? ` · ${promotion.label}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
