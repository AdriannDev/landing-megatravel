"use client";
import { useEffect, useState } from "react";
import { PromotionSelect, usePromotionOptions } from "./promotion-select";

type Source = {
  id: string | number;
  program: string;
  mtpe: string;
  price: number;
  date: string;
  origin: string;
  programId?: string | number;
  availableSeats?: number | null;
  initialSeats?: number | null;
  initialLastSeats?: boolean;
};
type Row = {
  date: string;
  price: string;
  availableSeats: string;
  origin: string;
  lastSeats: string;
  promotion: string;
};
const emptyRow = (price = ""): Row => ({
  date: "",
  price,
  availableSeats: "", origin: "", lastSeats: "",
  promotion: "",
});

export function NewDate() {
  const [sources, setSources] = useState<Source[]>([]),
    [sourceId, setSourceId] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const promotionOptions = usePromotionOptions();
  const [created, setCreated] = useState<
    { id: string | number; date: string; href: string; preview: string }[]
  >([]);
  const [createdStatus, setCreatedStatus] = useState<"draft" | "published">("draft");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin-tools/options", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "No se pudieron cargar las salidas. Recarga la página.",
          );
        return r.json();
      })
      .then((data) => setSources(data.departures))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const source = sources.find((s) => String(s.id) === sourceId);
  const update = (index: number, change: Partial<Row>) =>
    setRows((values) =>
      values.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );
  return (
    <section className="mt-workspace mt-create">
      <a href="/admin/collections/departures">← Volver a salidas</a>
      <h1>Nueva fecha</h1>
      <p>Agrega fechas a un programa que ya existe.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const status = submitter?.value === "published" ? "published" : "draft";
          try {
            const response = await fetch("/api/admin-tools/duplicate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceId,
                status,
                seatsConfirmed:
                  new FormData(e.currentTarget).get("seatsConfirmed") === "on",
                departures: rows.map((row) => ({
                  date: row.date,
                  price: Number(row.price),
                  availableSeats: row.availableSeats === "" ? undefined : Number(row.availableSeats),
                  origin: row.origin || undefined,
                  lastSeats: row.lastSeats === "" ? undefined : row.lastSeats === "true",
                  promotions: row.promotion ? [row.promotion] : [],
                })),
              }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "No se pudo guardar.");
            setCreatedStatus(status);
            setCreated(result.created);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || created.length > 0}>
          <legend>Programa y salida base</legend>
          <p>
            Se asignara la imagen y enlaces del bloqueo seleccionado.
          </p>
          <label>
            Salida base
            <select
              required
              value={sourceId}
              onChange={(event) => {
                const id = event.target.value;
                setSourceId(id);
                setRows([
                  emptyRow(
                    String(
                      sources.find((s) => String(s.id) === id)?.price || "",
                    ),
                  ),
                ]);
              }}
            >
              <option value="">Selecciona una salida existente</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.program} · MTPE {s.mtpe} · {s.origin} · {s.date}
                </option>
              ))}
            </select>
          </label>
          {source && (
            <p>
              Cantidad inicial para nuevas salidas: {source.initialSeats ?? "Sin informar"}.{" "}
              {source.initialLastSeats
                ? "La etiqueta inicial «Últimos cupos» está activada. "
                : ""}
              {source.programId && (
                <a href={`/admin/collections/programs/${source.programId}`}>
                  Editar valores iniciales del programa
                </a>
              )}
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy || created.length > 0}>
          <legend>Fechas de salida</legend>
          <p>
            Agrega hasta 30 fechas. Las promociones y la etiqueta «Últimos
            cupos» son opcionales por fecha. Cada fecha conserva su propia disponibilidad.
          </p>
          {promotionOptions.error && (
            <p role="alert">{promotionOptions.error}</p>
          )}
          {rows.map((row, index) => (
            <div
              className="mt-new-departure mt-new-departure-seats"
              key={index}
            >
              <label>
                Fecha de salida {index + 1}
                <input
                  type="date"
                  required
                  value={row.date}
                  onChange={(e) => update(index, { date: e.target.value })}
                />
              </label>
              <label>
                Precio {index + 1}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={row.price}
                  onChange={(e) => update(index, { price: e.target.value })}
                />
              </label>
              <PromotionSelect
                promotions={promotionOptions.promotions}
                loading={promotionOptions.loading}
                value={row.promotion}
                index={index}
                onChange={(value) => update(index, { promotion: value })}
              />
              <label>Origen de salida {index + 1}<input value={row.origin} placeholder="Usar origen base" onChange={e => setRows(values => values.map((r, i) => i === index ? { ...r, origin: e.target.value } : r))} /></label>
              <label>Cupos disponibles {index + 1}<input type="number" min="0" step="1" value={row.availableSeats} placeholder="Usar cantidad inicial" onChange={e => setRows(values => values.map((r, i) => i === index ? { ...r, availableSeats: e.target.value } : r))} /></label>
              <label>Últimos cupos {index + 1}<select value={row.lastSeats} onChange={e => setRows(values => values.map((r, i) => i === index ? { ...r, lastSeats: e.target.value } : r))}><option value="">Usar etiqueta inicial</option><option value="true">Activar</option><option value="false">Desactivar</option></select></label>
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar fecha ${index + 1}`}
                  onClick={() =>
                    setRows((values) => values.filter((_, i) => i !== index))
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            className="mt-inline-button"
            type="button"
            disabled={rows.length >= 30}
            onClick={() =>
              setRows((values) => [
                ...values,
                emptyRow(String(source?.price || "")),
              ])
            }
          >
            + Añadir otra fecha
          </button>
          
          {rows.some((row) => row.lastSeats === "true" || row.availableSeats !== "") && (
            <label className="mt-check">
              <input type="checkbox" name="seatsConfirmed" required />
              Confirmo la disponibilidad actual de las salidas
            </label>
          )}
          <div className="mt-action-row">
            <button className="mt-tool-button secondary" disabled={!sourceId} type="submit" value="draft">
              Crear {rows.length === 1 ? "borrador" : `${rows.length} borradores`}
            </button>
            <button className="mt-tool-button" disabled={!sourceId} type="submit" value="published">
              Publicar {rows.length === 1 ? "salida" : `${rows.length} salidas`}
            </button>
          </div>
        </fieldset>
      </form>
      {busy && <p role="status">Guardando fechas…</p>}
      {error && (
        <p role="alert" className="mt-report-error">
          {error}
        </p>
      )}
      {created.length > 0 && (
        <div role="status">
          <h2>{createdStatus === "published" ? "Salidas publicadas" : "Borradores creados"}</h2>
          {created.map((item) => (
            <p key={item.id}>
              <a href={item.href}>{createdStatus === "published" ? "Ver salida" : "Revisar y publicar salida"} del {item.date}</a>{" "}
              ·{" "}
              <a href={item.preview} target="_blank" rel="noopener noreferrer">
                Vista previa ↗
              </a>
            </p>
          ))}
          <a href="/admin/new-date" className="mt-tool-button secondary">
            Agregar más fechas
          </a>
        </div>
      )}
    </section>
  );
}
