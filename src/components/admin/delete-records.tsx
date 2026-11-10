"use client";
import {
  useAuth,
  useDocumentInfo,
  useListQuery,
  useSelection,
} from "@payloadcms/ui";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import styles from "./departure-actions.module.css";
import { trapDialogFocus } from "./modal-focus";

type Summary = {
  programs: number;
  departures: number;
  token: string;
  preparedAt: number;
};
function DeleteRecords({
  collection,
  ids,
  label,
  onDeleted,
}: {
  collection: "programs" | "departures";
  ids: (string | number)[];
  label: string;
  onDeleted?: () => void;
}) {
  const { user } = useAuth(),
    router = useRouter(),
    title = useId();
  const trigger = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    working = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState("");
  const [selection, setSelection] = useState<(string | number)[]>([]);
  useEffect(() => {
    if (summary && !dialog.current?.open) dialog.current?.showModal();
  }, [summary]);
  const close = () => {
    if (!working.current) {
      dialog.current?.close();
      setSummary(null);
      trigger.current?.focus();
    }
  };
  async function run(action: "preview" | "delete") {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/admin-tools/delete-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection,
          ids: action === "preview" ? ids : selection,
          action,
          confirmation: summary,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "No se pudo eliminar la selección.");
      if (action === "preview") {
        setSelection([...ids]);
        setSummary(body);
      } else {
        if (!body.programs && !body.departures)
          throw new Error(
            "No se eliminó ningún registro. Actualiza la selección.",
          );
        dialog.current?.close();
        setSummary(null);
        setResult(
          `${body.programs} programas y ${body.departures} salidas eliminados.`,
        );
        trigger.current?.focus();
        router.refresh();
        onDeleted?.();
        window.dispatchEvent(new Event("mt-departures-changed"));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  if (user?.role !== "admin") return null;
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        ref={trigger}
        className={styles.deleteButton}
        type="button"
        disabled={busy || !ids.length || ids.length > 200}
        onClick={() => void run("preview")}
      >
        {busy ? "Procesando…" : label}
      </button>
      {result && <span role="status"> {result}</span>}
      {error && !summary && <span role="alert"> {error}</span>}
      {summary &&
        createPortal(
          <dialog
            ref={dialog}
            className={styles.dialog}
            aria-labelledby={title}
            onKeyDown={trapDialogFocus}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run("delete");
              }}
            >
              <h2 id={title}>Confirmar eliminación</h2>
              <p>
                Se eliminarán <strong>{summary.programs} programas</strong> y{" "}
                <strong>{summary.departures} salidas</strong>.
              </p>
              <p>
                Esta acción es irreversible. Se conservará una copia de los
                datos en el historial. Las imágenes y los catálogos se mantienen
                disponibles.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className={styles.actions}>
                <button type="button" disabled={busy} onClick={close} autoFocus>
                  Cancelar
                </button>
                <button type="submit" disabled={busy}>
                  {busy ? "Eliminando…" : "Confirmar eliminación"}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </span>
  );
}
function BulkDelete({ collection }: { collection: "programs" | "departures" }) {
  const { selectedIDs, selectAll, toggleAll, count } = useSelection();
  const { refineListData, query } = useListQuery();
  return (
    <div className={styles.bulk}>
      <DeleteRecords
        collection={collection}
        ids={selectAll === "allAvailable" ? [] : selectedIDs}
        label={`Eliminar selección (${count})`}
        onDeleted={() => {
          toggleAll();
          void refineListData(query);
        }}
      />
      {selectAll === "allAvailable" && (
        <span>
          Selecciona hasta 200 registros de la página para revisar su
          eliminación.
        </span>
      )}
    </div>
  );
}
export function BulkProgramDelete() {
  return <BulkDelete collection="programs" />;
}
export function BulkDepartureDelete() {
  return <BulkDelete collection="departures" />;
}
export function ProgramDocumentDelete() {
  const { id } = useDocumentInfo(),
    router = useRouter();
  return id ? (
    <DeleteRecords
      collection="programs"
      ids={[id]}
      label="Eliminar programa"
      onDeleted={() => router.push("/admin/collections/programs")}
    />
  ) : null;
}
