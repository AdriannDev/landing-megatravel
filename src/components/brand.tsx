"use client";
import { useState } from "react";
import { OFFICIAL_LOGO_URL } from "@/lib/brand-config";
export function Brand({ inverted = false }: { inverted?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!failed)
    return (
      <a
        className={`brand ${inverted ? "brand-inverted" : ""}`}
        href="/"
        aria-label="Megatravel Perú, inicio"
      >
        <img
          className="official-logo"
          src={OFFICIAL_LOGO_URL}
          alt="Megatravel Perú"
          width="210"
          height="54"
          onError={() => setFailed(true)}
        />
      </a>
    );
  return (
    <a
      className={`brand ${inverted ? "brand-inverted" : ""}`}
      href="/"
      aria-label="Megatravel Perú, inicio"
    >
      <svg
        className="brand-symbol"
        viewBox="0 0 38 38"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 30 11 7h8l-3.5 9L27 7h9L17 24l-3 8H7l3-9-8 7Z"
          fill="currentColor"
        />
        <path d="m22 23 8-7-5 16h-7l4-9Z" fill="#F47B20" />
      </svg>
      <span>
        <strong>
          mega<span>travel</span>
        </strong>
        <small>OPERADORA MAYORISTA · PERÚ</small>
      </span>
    </a>
  );
}
