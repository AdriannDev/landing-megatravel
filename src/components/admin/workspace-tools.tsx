"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  departureViews,
  departureViewURL,
  parseDepartureView,
} from "@/lib/admin-views";

type Report = {
  error?: string;
  accepted?: number;
  errors?: number;
  dryRun?: boolean;
  results?: { row?: number; status: string; message?: string; availableSeats?: number | null; lastSeats?: boolean; validationToken?: string }[];
};
type Stats = {
  published: number;
  expiring: number;
  seatsReview: number;
  programs: number;
};

export function WorkspaceTools() {
  const currentView = parseDepartureView(useSearchParams().get("mtView"));
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false),
    [report, setReport] = useState<Report | null>(null);
  const [seatsConfirmed, setSeatsConfirmed] = useState(false);
  const [validationTokens, setValidationTokens] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null),
    [downloadImages, setDownloadImages] = useState(true),
    [validatedFile, setValidatedFile] = useState<File | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () =>
      fetch("/api/admin-tools/stats", {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(setStats)
        .catch(() => {});
    void refresh();
    window.addEventListener("mt-departures-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("mt-departures-changed", refresh);
    };
  }, []);
  const csv = async (dryRun: boolean) => {
    if (!file || (!dryRun && validatedFile !== file)) return;
    const body = new FormData();
    body.set("file", file);
    body.set("dryRun", String(dryRun));
    body.set("downloadImages", String(downloadImages));
    body.set("seatsConfirmed", String(seatsConfirmed));
    body.set("validationTokens", JSON.stringify(validationTokens));
    setBusy(true);
    setReport(null);
    try {
      const response = await fetch("/api/admin-tools/import", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo completar la operación.");
      setReport(data);
      if (dryRun && data.accepted > 0) { setValidatedFile(file); setValidationTokens(Object.fromEntries(data.results.filter((r: { validationToken?: string }) => r.validationToken).map((r: { row: number; validationToken: string }) => [String(r.row), r.validationToken]))); }
      if (!dryRun) {
        setValidatedFile(null);
        window.dispatchEvent(new Event("mt-departures-changed"));
      }
    } catch (error) {
      setReport({ error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-workspace mt-dashboard">
      <div className="mt-workspace-title">
        <div>
          <small>BLOQUEOS</small>
          <h1>Salidas</h1>
          <p>Organiza y mantén al día las fechas de tus programas.</p>
        </div>
        <div className="mt-action-row">
          <a
            className="mt-tool-button secondary"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver catálogo ↗
          </a>
          <a className="mt-tool-button secondary" href="/admin/new-date">
            Nueva fecha
          </a>
          <a className="mt-tool-button" href="/admin/new-departure">
            + Nueva salida
          </a>
        </div>
      </div>
      <div className="mt-stats" aria-label="Resumen de salidas">
        {[
          ["Publicadas", stats?.published, "Salidas activas"],
          ["Próximas a retirarse", stats?.expiring, "Requieren seguimiento"],
          ["Cupos por revisar", stats?.seatsReview, "Pendientes de actualizar"],
          ["MTPE", stats?.programs, "Programas con código único"],
        ].map(([label, value, description]) => (
          <div className="mt-stat" key={String(label)}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
            <small>{description}</small>
          </div>
        ))}
      </div>
      <div className="mt-list-heading">
        <div>
          <h3>Listado de salidas</h3>
          <p>
            Una tarjeta por fecha. El contenido compartido se edita en
            Programas.
          </p>
        </div>
        <a
          className="mt-tool-button secondary"
          href="/admin/collections/programs"
        >
          Programas →
        </a>
      </div>
      <nav className="mt-saved-views" aria-label="Vistas de salidas">
        {Object.entries(departureViews).map(([view, label]) => (
          <a
            key={view}
            aria-current={currentView === view ? "page" : undefined}
            href={departureViewURL(parseDepartureView(view))}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-tool-grid">
        <details>
          <summary>Importar o exportar CSV</summary>
          <div className="mt-import-form">
            <p>
              Primero valida el archivo. Las claves de importación permiten
              actualizar sin duplicar salidas.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Archivo CSV de salidas"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setValidatedFile(null); setSeatsConfirmed(false); setValidationTokens({});
              }}
            />
            <label className="mt-check">
              <input
                type="checkbox"
                checked={downloadImages}
                onChange={(e) => setDownloadImages(e.target.checked)}
              />
              Descargar imágenes al almacenamiento
            </label>
            <label className="mt-check"><input type="checkbox" checked={seatsConfirmed} onChange={e => setSeatsConfirmed(e.target.checked)} />Confirmo que los cupos del CSV son la disponibilidad actual, con las ventas anteriores consideradas</label>
            <div className="mt-action-row">
              <button
                className="mt-tool-button secondary"
                disabled={!file || busy}
                onClick={() => csv(true)}
              >
                Validar sin importar
              </button>
              <button
                className="mt-tool-button"
                disabled={!file || validatedFile !== file || busy || (Object.keys(validationTokens).length > 0 && !seatsConfirmed)}
                onClick={() => csv(false)}
              >
                Importar filas válidas
              </button>
            </div>
            <a href="/api/admin-tools/export" className="mt-export-link">
              Exportar catálogo completo en CSV
            </a>
          </div>
        </details>
      </div>
      {busy && <p role="status">Procesando… Mantén esta página abierta.</p>}
      {report && (
        <div className="mt-report" role="status">
          {report.error ? (
            <p className="mt-report-error">{report.error}</p>
          ) : (
            <>
              {report.accepted !== undefined && (
                <p>
                  <strong>
                    {report.dryRun ? "Validación" : "Importación"}:
                  </strong>{" "}
                  {report.accepted} filas válidas, {report.errors || 0} con
                  errores.
                </p>
              )}
              {report.results && (
                <details>
                  <summary>Ver reporte por fila</summary>
                  <div className="mt-report-rows">
                    {report.results.map((result, i) => (
                      <p key={i}>
                        Fila {result.row}: {result.status}
                        {result.message ? " — " + result.message : ""}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
