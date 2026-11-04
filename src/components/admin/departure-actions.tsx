"use client";

import { useAuth } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./departure-actions.module.css";

export function DepartureActions({
  id,
  status,
  program,
}: {
  id: string | number;
  status: string;
  program: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<"withdraw" | "delete" | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => setReady(true), []);
  const restoreFocus = () => trigger.current?.focus({ preventScroll: true });
  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const reposition = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const height = menu.current?.offsetHeight || 152;
      setPosition({
        top: Math.max(
          8,
          box.bottom + height > window.innerHeight
            ? box.top - height
            : box.bottom + 4,
        ),
        left: Math.max(8, Math.min(box.right - 200, window.innerWidth - 208)),
      });
    };
    const closeOnScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) reposition();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);
  useEffect(() => {
    if (mode && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [mode]);
  function choose(value: "withdraw" | "delete") {
    setOpen(false);
    setReason("");
    setNote("");
    setError("");
    setMode(value);
  }
  function closeDialog() {
    if (!busy) {
      setMode(null);
      restoreFocus();
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin-tools/departure-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: mode, reason, note }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "No se pudo completar la operación.");
      setMode(null);
      restoreFocus();
      router.refresh();
      window.dispatchEvent(new Event("mt-departures-changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className={styles.wrapper} onClick={(e) => e.stopPropagation()}>
      <button
        ref={trigger}
        type="button"
        disabled={!ready}
        className={styles.trigger}
        aria-label={`Opciones para ${program}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const height =
            user?.role === "admin" && status === "draft" ? 152 : 112;
          setPosition({
            top: Math.max(
              8,
              box.bottom + height > window.innerHeight
                ? box.top - height
                : box.bottom + 4,
            ),
            left: Math.max(
              8,
              Math.min(box.right - 200, window.innerWidth - 208),
            ),
          });
          setOpen(!open);
        }}
      >
        ···
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className={styles.menu}
            role="menu"
            aria-label={`Acciones de ${program}`}
            style={position}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                restoreFocus();
              }
              if (e.key === "Tab") setOpen(false);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const items = [
                  ...(menu.current?.querySelectorAll<HTMLElement>(
                    '[role="menuitem"]',
                  ) || []),
                ];
                const index = items.indexOf(
                  document.activeElement as HTMLElement,
                );
                items[
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length
                ]?.focus();
              }
            }}
          >
            <a
              role="menuitem"
              href={`/admin/collections/departures/${encodeURIComponent(String(id))}`}
            >
              Editar
            </a>
            {status !== "withdrawn" && (
              <button
                role="menuitem"
                type="button"
                onClick={() => choose("withdraw")}
              >
                Retirar
              </button>
            )}
            {user?.role === "admin" && status === "draft" && (
              <button
                role="menuitem"
                type="button"
                onClick={() => choose("delete")}
              >
                Eliminar borrador
              </button>
            )}
          </div>,
          document.body,
        )}
      {mode &&
        createPortal(
          <dialog
            ref={dialog}
            className={styles.dialog}
            aria-labelledby={titleId}
            onCancel={(e) => {
              e.preventDefault();
              closeDialog();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) closeDialog();
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <h2 id={titleId}>
                {mode === "delete"
                  ? "¿Eliminar este borrador?"
                  : "Retirar salida"}
              </h2>
              <p>{program}</p>
              {mode === "delete" ? (
                <p>
                  Esta acción elimina el borrador y queda registrada en el
                  historial.
                </p>
              ) : (
                <>
                  <label>
                    Motivo
                    <select
                      required
                      disabled={busy}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      <option value="">Selecciona un motivo</option>
                      <option value="request">Solicitud del área</option>
                      <option value="sold-out">Sin stock</option>
                      <option value="price-change">Cambio de precio</option>
                      <option value="other">Otro</option>
                    </select>
                  </label>
                  {reason === "other" && (
                    <label>
                      Explicación
                      <textarea
                        required
                        disabled={busy}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              {error && <p role="alert">{error}</p>}
              <div className={styles.actions}>
                <button type="button" onClick={closeDialog} disabled={busy}>
                  Cancelar
                </button>
                <button type="submit" disabled={busy}>
                  {busy
                    ? "Guardando…"
                    : mode === "delete"
                      ? "Confirmar eliminación"
                      : "Confirmar retiro"}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </span>
  );
}
