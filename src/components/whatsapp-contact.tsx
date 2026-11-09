"use client";
import { useEffect, useState } from "react";
import "./whatsapp-contact.css";

export function WhatsAppContact({ contactUrl }: { contactUrl: string }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    const show = () => {
      setExpanded(true);
      hideTimer = setTimeout(() => setExpanded(false), 4500);
    };
    const initialTimer = setTimeout(show, 2500);
    const interval = setInterval(show, 14000);
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, []);

  let url: URL;
  try {
    url = new URL(contactUrl);
  } catch {
    return null;
  }

  // The CMS contact link can point elsewhere; never label another channel as WhatsApp.
  if (
    url.protocol !== "https:" ||
    ![
      "wa.me",
      "api.whatsapp.com",
      "web.whatsapp.com",
      "whatsapp.com",
      "www.whatsapp.com",
    ].includes(url.hostname)
  )
    return null;

  return (
    <a
      className={`whatsapp-contact${expanded ? " is-expanded" : ""}`}
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp, abre otra pestaña"
    >
      <span className="whatsapp-contact-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
          <path d="M20.52 3.48A11.89 11.89 0 0 0 12.05 0C5.45 0 .08 5.37.08 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62a11.9 11.9 0 0 0 5.87 1.5h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-1.25-6.21-3.51-8.43ZM12.05 21.86h-.01c-1.87 0-3.7-.5-5.29-1.44l-.38-.23-3.67.96.98-3.58-.25-.37a9.88 9.88 0 0 1-1.52-5.23c0-5.47 4.45-9.92 9.92-9.92 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.92 9.92Zm5.44-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49 0 1.47 1.08 2.89 1.23 3.09.15.2 2.12 3.23 5.14 4.53.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      </span>
      <span className="whatsapp-contact-copy" aria-hidden="true">
        <span>¿Tienes consultas?</span>
        <strong>Escríbenos</strong>
      </span>
    </a>
  );
}
