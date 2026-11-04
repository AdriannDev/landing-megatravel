"use client";
import { useEffect, useState } from "react";
import { useListDrawer } from "@payloadcms/ui";
import { PromotionSelect, usePromotionOptions } from "./promotion-select";

type Program = {
  id: string | number;
  program: string;
  mtpe: string;
  availableSeats?: number | null;
  lastSeats?: boolean;
  seatsMigrationPending?: boolean;
};
export function NewDeparture() {
  const [imageMode, setImageMode] = useState<"none" | "existing" | "upload" | "url">("none");
  const [selectedImage, setSelectedImage] = useState<{ id: string | number; label: string; url?: string } | null>(null);
  const [ImageDrawer, , { openDrawer, closeDrawer }] = useListDrawer({ collectionSlugs: ["media"], selectedCollection: "media", uploads: true });
  const [programs, setPrograms] = useState<Program[]>([]),
    [programId, setProgramId] = useState("");
  const [rows, setRows] = useState([
      { date: "", price: "", lastSeats: false, promotion: "" },
    ]),
    [busy, setBusy] = useState(false);
  const promotionOptions = usePromotionOptions();
  const [programSeats, setProgramSeats] = useState(""),
    [programLastSeats, setProgramLastSeats] = useState(false);
  const selectedProgram = programs.find((p) => String(p.id) === programId);
  const [error, setError] = useState(""),
    [created, setCreated] = useState<
      { id: number; date: string; href: string; preview: string }[]
    >([]);
  const [createdStatus, setCreatedStatus] = useState<"draft" | "published">(
    "draft",
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin-tools/programs", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "No se pudieron cargar los programas. Recarga la página.",
          );
        return r.json();
      })
      .then((data) => setPrograms(data.programs))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="mt-workspace mt-create">
      <a href="/admin/collections/departures">← Volver a salidas</a>
      <small>CREAR BLOQUEO / SALIDAS</small>
      <h1>Nueva salida</h1>
      <p>
        Elige o crea un programa y añade hasta 30 fechas. Puedes publicarlas
        directamente o guardarlas como borrador.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent)
            .submitter as HTMLButtonElement | null;
          const status =
            submitter?.value === "published" ? "published" : "draft";
          const text = (name: string) => String(data.get(name) || "").trim();
          const file = data.get("flyer") as File | null;
          try {
            const body = new FormData();
            body.set(
              "data",
              JSON.stringify({
                status,
                seatsConfirmed: data.get("seatsConfirmed") === "on",
                programId: programId || undefined,
                program: programId
                  ? undefined
                  : {
                      program: text("program"),
                      mtpe: text("mtpe"),
                      destination: text("destination"),
                      zone: text("zone"),
                      days: Number(text("days")),
                      nights: text("nights") ? Number(text("nights")) : null,
                      cruiseLine: text("cruiseLine"),
                      flyerSourceUrl: imageMode === "url" ? text("flyerSourceUrl") : "",
                      flyer: imageMode === "existing" ? selectedImage?.id : undefined,
                      bookingUrl: text("bookingUrl"),
                      descriptionUrl: text("descriptionUrl"),
                      availableSeats:
                        programSeats === "" ? null : Number(programSeats),
                      lastSeats: programLastSeats,
                      seatsConfirmed:
                        data.get("programSeatsConfirmed") === "on",
                    },
                origin: text("origin"),
                currency: text("currency"),
                priceCondition: text("priceCondition"),
                advanceDays: Number(text("advanceDays")),
                priority: Number(text("priority")),
                departures: rows.map((row) => ({
                  date: row.date,
                  price: Number(row.price),
                  lastSeats: row.lastSeats,
                  promotions: row.promotion ? [row.promotion] : [],
                })),
              }),
            );
            if (!programId && imageMode === "existing" && !selectedImage) throw new Error("Selecciona una imagen de la biblioteca.");
            if (!programId && imageMode === "upload" && !file?.size) throw new Error("Selecciona un archivo de imagen.");
            if (!programId && imageMode === "upload" && file?.size) body.set("flyer", file);
            const response = await fetch("/api/admin-tools/create-departures", {
              method: "POST",
              body,
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "No se pudo guardar.");
            setCreatedStatus(status);
            setCreated(result.created);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || created.length > 0}>
          <legend>Programa</legend>
          <label>
            Selecciona un programa o crea uno nuevo
            <select
              name="programId"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <option value="">Crear un programa nuevo</option>
              {programs.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.program} · MTPE {p.mtpe}
                </option>
              ))}
            </select>
          </label>
          {!programId && (
            <div className="mt-form-grid">
              <label>
                Nombre del programa
                <input name="program" required />
              </label>
              <label>
                MTPE
                <input name="mtpe" required />
              </label>
              <label>
                Destino
                <input name="destination" required />
              </label>
              <label>
                Zona
                <input name="zone" required />
              </label>
              <label>
                Días
                <input name="days" type="number" min="1" step="1" required />
              </label>
              <label>
                Noches
                <input name="nights" type="number" min="0" step="1" />
              </label>
              <label>
                Naviera (solo cruceros)
                <input name="cruiseLine" />
              </label>
              <div>
                <label>
                  Imagen del programa (opcional)
                  <select value={imageMode} onChange={(e) => setImageMode(e.target.value as typeof imageMode)}>
                    <option value="none">Usar imagen temporal</option>
                    <option value="existing">Seleccionar de la biblioteca</option>
                    <option value="upload">Subir una imagen</option>
                    <option value="url">Usar enlace HTTPS</option>
                  </select>
                </label>
                {imageMode === "existing" && <>
                  <button type="button" className="mt-tool-button secondary" onClick={openDrawer}>Seleccionar imagen</button>
                  {selectedImage && <div className="mt-selected-image">
                    {selectedImage.url && <img src={selectedImage.url} alt="" width={80} height={80} />}
                    <p>Seleccionada: {selectedImage.label} <button type="button" className="mt-inline-button" onClick={() => setSelectedImage(null)}>Quitar</button></p>
                  </div>}
                </>}
                {imageMode === "upload" && <label>Archivo de imagen<input name="flyer" type="file" required accept="image/png,image/jpeg,image/webp,image/gif" /></label>}
                {imageMode === "url" && <label>Enlace HTTPS de la imagen<input name="flyerSourceUrl" type="url" required pattern="https://.*" /></label>}
                <small>Ideal: 800x800 px. Admite otros tamaños y proporciones, sin recortar. Máximo 12 MB.</small>
              </div>
              <label>
                Link programa en Meganet
                <input name="bookingUrl" type="url" pattern="https://.*" />
              </label>
              <label>
                Link descriptivo en Café
                <input name="descriptionUrl" type="url" pattern="https://.*" />
              </label>
              <p>
                Sin imagen se mostrará la de Megatravel. Completa los enlaces
                antes de publicar.
              </p>
              <label>
                Sillas Disponibles (Opcional)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={programSeats}
                  onChange={(e) => setProgramSeats(e.target.value)}
                />
                <small>
                  Se aplicara la cantidad de sillas a todas las fechas del programa. Dejar vacío si no aplica.
                </small>
              </label>
              <label className="mt-check">
                <input
                  type="checkbox"
                  checked={programLastSeats}
                  onChange={(e) => setProgramLastSeats(e.target.checked)}
                />
                Últimos cupos en todas las fechas
              </label>
              {(programSeats !== "" || programLastSeats) && (
                <label className="mt-check">
                  <input
                    type="checkbox"
                    name="programSeatsConfirmed"
                    required
                  />
                  Confirmo que he verificado los cupos del programa
                </label>
              )}
            </div>
          )}
          {selectedProgram && (
            <p>
              Cupos compartidos:{" "}
              {selectedProgram.seatsMigrationPending
                ? "Pendientes de revisión"
                : (selectedProgram.availableSeats ?? "Sin informar")}
              .{" "}
              <a href={`/admin/collections/programs/${selectedProgram.id}`}>
                Editar saldo y etiqueta grupal en Programas
              </a>
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy || created.length > 0}>
          <legend>Condiciones de las nuevas salidas</legend>
          <div className="mt-form-grid">
            <label>
              Origen
              <input name="origin" required defaultValue="Lima" />
            </label>
            <label>
              Moneda
              <select name="currency" defaultValue="USD">
                <option value="USD">USD</option>
                <option value="PEN">PEN</option>
              </select>
            </label>
            <label>
              Condición del precio
              <input
                name="priceCondition"
                required
                defaultValue="Por persona en habitación doble"
              />
            </label>
            <label>
              Retirar con anticipación (días)
              <input
                name="advanceDays"
                required
                type="number"
                min="0"
                max="3650"
                step="1"
                defaultValue="30"
              />
            </label>
            <label>
              Prioridad
              <input name="priority" type="number" defaultValue="0" />
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy || created.length > 0}>
          <legend>Fechas de salida</legend>
          <p>
            Agrega hasta 30 fechas. Las promociones y la etiqueta «Últimos
            cupos» son opcionales por fecha. La cantidad de cupos se comparte
            con el programa.
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
                  aria-label={`Fecha de salida ${index + 1}`}
                  required
                  type="date"
                  value={row.date}
                  onChange={(e) =>
                    setRows((values) =>
                      values.map((r, i) =>
                        i === index ? { ...r, date: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Precio {index + 1}
                <input
                  aria-label={`Precio de salida ${index + 1}`}
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={row.price}
                  onChange={(e) =>
                    setRows((values) =>
                      values.map((r, i) =>
                        i === index ? { ...r, price: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <PromotionSelect
                promotions={promotionOptions.promotions}
                loading={promotionOptions.loading}
                value={row.promotion}
                index={index}
                onChange={(value) =>
                  setRows((values) =>
                    values.map((r, i) =>
                      i === index ? { ...r, promotion: value } : r,
                    ),
                  )
                }
              />
              <label className="mt-check">
                <input
                  type="checkbox"
                  aria-label={`Últimos cupos de salida ${index + 1}`}
                  checked={row.lastSeats}
                  onChange={(e) =>
                    setRows((values) =>
                      values.map((r, i) =>
                        i === index ? { ...r, lastSeats: e.target.checked } : r,
                      ),
                    )
                  }
                />
                Últimos cupos solo en esta fecha
              </label>
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar salida ${index + 1}`}
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
                { date: "", price: "", lastSeats: false, promotion: "" },
              ])
            }
          >
            + Añadir otra fecha
          </button>

          {rows.some((row) => row.lastSeats) && (
            <label className="mt-check">
              <input type="checkbox" name="seatsConfirmed" required />
              Confirmo que «Últimos cupos» está vigente en las fechas marcadas
            </label>
          )}
          <div className="mt-action-row">
            <a
              className="mt-tool-button secondary"
              href="/admin/collections/departures"
            >
              Cancelar
            </a>
            <button
              className="mt-tool-button secondary"
              type="submit"
              value="draft"
            >
              Guardar como borrador
            </button>
            <button className="mt-tool-button" type="submit" value="published">
              Publicar salidas
            </button>
          </div>
        </fieldset>
      </form>
      <ImageDrawer allowCreate={false} onSelect={({ doc }) => {
        if (typeof doc.id === "number" || typeof doc.id === "string") {
          setSelectedImage({ id: doc.id, label: String(doc.alt || doc.filename || `Imagen ${doc.id}`), url: typeof doc.url === "string" ? doc.url : undefined });
        }
        closeDrawer();
      }} />
      {busy && <p role="status">Guardando programa y fechas…</p>}
      {error && (
        <p role="alert" className="mt-report-error">
          {error}
        </p>
      )}
      {created.length > 0 && (
        <div role="status">
          <h2>
            {createdStatus === "published"
              ? "Salidas publicadas"
              : "Borradores creados"}
          </h2>
          {created.map((item) => (
            <p key={item.id}>
              <a href={item.href}>
                {createdStatus === "published"
                  ? "Ver salida"
                  : "Revisar y publicar salida"}{" "}
                del {item.date}
              </a>{" "}
              ·{" "}
              <a href={item.preview} target="_blank" rel="noopener noreferrer">
                Vista previa ↗
              </a>
            </p>
          ))}
          <a className="mt-tool-button secondary" href="/admin/new-departure">
            Crear más salidas
          </a>
        </div>
      )}
    </section>
  );
}
