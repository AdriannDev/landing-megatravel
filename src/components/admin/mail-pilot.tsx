"use client";
import { useRef, useState } from "react";

export function MailPilot() {
  const working = useRef(false);
  const [busy, setBusy] = useState(false),
    [report, setReport] = useState(""),
    [error, setError] = useState("");
  async function submit(form: HTMLFormElement, action: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setReport("");
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/admin-tools/mail-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          action,
          ...(action === "baseline"
            ? {
                initialSeats: Number(data.initialSeats),
                cutoffAt: new Date(String(data.cutoffAt)).toISOString(),
              }
            : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setReport(
        action === "baseline"
          ? `Saldo simulado creado: ${body.result.remainingSeats} sillas.`
          : `${body.result.reason}${body.result.delta != null ? ` Variación: ${body.result.delta}. Saldo simulado: ${body.result.balanceAfter}.` : ""}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mt-workspace">
      <h1>Piloto de cupos por correo</h1>
      <p>
        Modo simulación. Los movimientos solo afectan al saldo de prueba; los
        cupos públicos se mantienen independientes.
      </p>
      <p>
        <a href="/admin/collections/seat-mail-events">
          Revisar avisos y movimientos
        </a>{" "}
        · <a href="/admin/collections/seat-pilot-pools">Saldos simulados</a> ·{" "}
        <a href="/admin/collections/seat-pilot-reservations">
          Reservas simuladas
        </a>
        {" "}· <a href="/admin/collections/mail-sync-cursors">Estado de lectores</a>
      </p>
      <div className="mt-tool-grid">
        <form
          className="mt-import-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "baseline");
          }}
        >
          <h2>Saldo inicial conciliado</h2>
          <p>
            Registra el saldo verificado y su fecha de corte. Solo se procesarán
            eventos posteriores. Un saldo existente no se reinicia.
          </p>
          <label>
            Código MTPE{" "}
            <input
              name="mtpe"
              required
              placeholder="MTPE-50026"
              disabled={busy}
            />
          </label>
          <label>
            Sillas disponibles{" "}
            <input
              name="initialSeats"
              type="number"
              min="0"
              max="100000"
              step="1"
              required
              disabled={busy}
            />
          </label>
          <label>
            Fecha y hora de corte (hora local){" "}
            <input
              name="cutoffAt"
              type="datetime-local"
              required
              disabled={busy}
            />
          </label>
          <button className="mt-tool-button" type="submit" disabled={busy}>
            Crear saldo simulado
          </button>
        </form>
        <form
          className="mt-import-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "simulate");
          }}
        >
          <h2>Probar un aviso anonimizado</h2>
          <p>
            Incluye únicamente campos comerciales. El cuerpo del correo no se
            almacena. Para los formatos reales se necesitan muestras completas
            anonimizadas de reserva, modificación y cancelación.
          </p>
          <label>
            Aviso{" "}
            <textarea
              name="body"
              required
              rows={11}
              maxLength={100000}
              disabled={busy}
              placeholder={
                "MTPE: MTPE-50026\nReserva: DEMO-001\nSalida: 21 nov 2026\nSillas: 3\nEstado: A petición\nTipo: reserva\nFecha del evento: 2026-11-10T12:00:00-05:00\nVersión: 1"
              }
            />
          </label>
          <button className="mt-tool-button" type="submit" disabled={busy}>
            Simular aviso
          </button>
        </form>
      </div>
      {busy && <p role="status">Procesando…</p>}
      {error && <p role="alert">{error}</p>}
      {report && <p role="status">{report}</p>}
    </section>
  );
}
