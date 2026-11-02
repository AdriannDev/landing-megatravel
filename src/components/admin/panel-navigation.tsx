"use client";

import { useAuth, useConfig } from "@payloadcms/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const catalog = [
  ["Destinos", "/collections/destinations"],
  ["Orígenes", "/collections/origins"],
  ["Navieras", "/collections/cruise-lines"],
] as const;
const administration = [
  ["Usuarios", "/collections/users"],
  ["Configuración del catálogo", "/globals/settings"],
  ["Historial de cambios", "/collections/audit-log"],
] as const;

function usePanelLinks() {
  const { config } = useConfig();
  const { user } = useAuth();
  const admin = config.routes.admin;
  return {
    admin,
    adminLinks: administration.filter(
      ([label]) =>
        label !== "Configuración del catálogo" || user?.role === "admin",
    ),
  };
}

export function PanelNavigation() {
  const pathname = usePathname();
  const { admin, adminLinks } = usePanelLinks();
  const link = (label: string, path: string) => {
    const isActive =
      pathname.startsWith(`${admin}${path}`) ||
      (path === "/collections/departures" &&
        [`${admin}/new-date`, `${admin}/new-departure`].some((route) =>
          pathname.startsWith(route),
        ));
    return (
      <Link
        key={path}
        href={`${admin}${path}`}
        className={`mt-panel-nav-link${isActive ? " active" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="mt-panel-navigation">
      <Link className="mt-panel-brand" href={admin}>
        <span className="mt-panel-mark" aria-hidden="true">
          ✦
        </span>
        <span>
          mega travel<small>PANEL DE GESTIÓN</small>
        </span>
      </Link>
      <div className="mt-panel-nav-heading">Gestión comercial</div>
      {link("Salidas", "/collections/departures")}
      {link("Programas", "/collections/programs")}
      {link("Promociones", "/collections/campaigns")}
      <div className="mt-panel-nav-heading">Contenido</div>
      {link("Imágenes", "/collections/media")}
      {link("Banners", "/collections/banners")}
      <div className="mt-panel-nav-heading">Gestión general</div>
      <details
        className="mt-panel-nav-group"
        open={
          catalog.some(([, path]) => pathname.startsWith(`${admin}${path}`)) ||
          undefined
        }
      >
        <summary>Catálogos</summary>
        <div>{catalog.map(([label, path]) => link(label, path))}</div>
      </details>
      <details
        className="mt-panel-nav-group"
        open={
          adminLinks.some(([, path]) =>
            pathname.startsWith(`${admin}${path}`),
          ) || undefined
        }
      >
        <summary>Administración</summary>
        <div>{adminLinks.map(([label, path]) => link(label, path))}</div>
      </details>
      <div className="mt-panel-nav-footer">
        Panel de administración
        <br />
        <strong>Equipo comercial</strong>
      </div>
    </div>
  );
}

export function ManagementTabs() {
  const pathname = usePathname();
  const { admin, adminLinks } = usePanelLinks();
  const links = catalog.some(([, path]) =>
    pathname.startsWith(`${admin}${path}`),
  )
    ? catalog
    : adminLinks;
  return (
    <nav
      className="mt-management-tabs"
      aria-label={links === catalog ? "Catálogos" : "Administración"}
    >
      {links.map(([label, path]) => (
        <Link
          key={path}
          href={`${admin}${path}`}
          aria-current={
            pathname.startsWith(`${admin}${path}`) ? "page" : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
