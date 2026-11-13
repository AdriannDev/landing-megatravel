"use client";

import { useFormFields } from "@payloadcms/ui";
import { useEffect, useState } from "react";
import styles from "./popup-preview.module.css";

export function PopupPreview() {
  const values = useFormFields(([fields]) =>
    Object.fromEntries(
      [
        "placement",
        "popupFormat",
        "image",
        "popupLabel",
        "popupKind",
        "title",
        "message",
        "buttonLabel",
        "popupSecondaryLabel",
        "href",
        "alt",
      ].map((key) => [key, fields[key]?.value]),
    ),
  );
  const [imageUrl, setImageUrl] = useState("");
  const image = values.image as
    string | number | { id?: string | number; url?: string } | null;
  const imageId = typeof image === "object" && image ? image.id : image;
  const directUrl = typeof image === "object" && image ? image.url : "";
  useEffect(() => {
    setImageUrl(directUrl || "");
    if (!imageId || directUrl) return;
    const controller = new AbortController();
    fetch(`/api/media/${encodeURIComponent(String(imageId))}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => setImageUrl(doc?.url || ""))
      .catch(() => {});
    return () => controller.abort();
  }, [imageId, directUrl]);
  if (values.placement !== "popup") return null;
  const imageOnly = values.popupFormat === "image";
  return (
    <section className={styles.section} aria-label="Vista previa del popup">
      <h3>Vista previa del popup</h3>
      <p>
        Así se verá aproximadamente con la imagen y el contenido seleccionados.
      </p>
      <div className={styles.stage}>
        <div className={`${styles.box}${imageOnly ? ` ${styles.imageOnly}` : imageUrl ? ` ${styles.withImage}` : ""}`}>
          <span className={styles.close} aria-hidden="true">×</span>
          {(imageUrl || imageOnly) && (
            <div className={styles.art}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={String(values.alt || "Vista previa de imagen")}
                />
              ) : (
                <span>Tu imagen aparecerá aquí</span>
              )}
            </div>
          )}
          {!imageOnly && (
            <div className={styles.copy}>
              <small>
                {String(
                  values.popupLabel ||
                    (values.popupKind === "news"
                      ? "Noticias Megatravel"
                      : "Especial para tu agencia"),
                )}
              </small>
              <h4>{String(values.title || "Aquí irá tu próxima promoción")}</h4>
              <p>
                {String(
                  values.message ||
                    "Agrega una descripción para compartir tu promoción o noticia.",
                )}
              </p>
              {!!values.href && (
                <span className={styles.button}>
                  {String(values.buttonLabel || "Conocer más")}
                </span>
              )}
              <span>
                {String(values.popupSecondaryLabel || "Seguir explorando")}
              </span>
            </div>
          )}
        </div>
      </div>
      <small>Vista orientativa · No guarda ni publica el contenido.</small>
    </section>
  );
}
