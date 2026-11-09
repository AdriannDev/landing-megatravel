import {
  ArrowUpRight,
  Globe,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Brand } from "./brand";
import "./site-footer.css";

const companyLinks = [
  { label: "Portal principal", href: "https://www.megatravel.pe/es/" },
  { label: "Quiénes somos", href: "https://www.megatravel.pe/es/landing/21393/quienes-somos" },
  { label: "Beneficios Mega", href: "https://www.megatravel.pe/es/landing/21360/beneficios-mega" },
  { label: "Café Mega Travel", href: "https://cafe.megatravel.pe/" },
  { label: "MegaBlog", href: "https://www.megatravel.pe/es/blog" },
  { label: "Capacitaciones Meganet", href: "https://calendly.com/meganet-megatravel/capacitacion-mega-travel" },
];

const destinationLinks = [
  { label: "Europa", href: "https://www.megatravel.pe/es/5413/europa/moreideas" },
  { label: "Medio Oriente", href: "https://www.megatravel.pe/es/4868/oriente-medio/moreideas" },
  { label: "Asia", href: "https://www.megatravel.pe/es/84/asia/moreideas" },
  { label: "Sudamérica", href: "https://www.megatravel.pe/es/4867/sur-america/moreideas" },
  { label: "Caribe y Centroamérica", href: "https://www.megatravel.pe/es/26/caribe/moreideas" },
  { label: "Cruceros", href: "https://www.megatravel.pe/es/161/crucero/moreideas" },
];

const socialLinks = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/megatravelperuoficial",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/megatravelperu",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.72 3.72 0 0 1-2.28 2.28c-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-2.28-2.28c-.16-.43-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23a3.72 3.72 0 0 1 2.28-2.28c.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-3.51 3.51C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.88 5.88 0 0 0 3.51 3.51c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 3.51-3.51c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-3.51-3.51C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@megatravelperu",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.05.85.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1Z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UCKhaRna0XN8vqUHjynYOSSA",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/mega-travel-per%C3%BA/posts/?feedView=all&viewAsMember=true",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
      </svg>
    ),
  },
];

export function SiteFooter({ contactUrl }: { contactUrl: string }) {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand-col">
          <Brand inverted />
          <p className="footer-tagline">
            El mundo en tus manos. Operadora mayorista de viajes en el Perú con
            el respaldo internacional de Mega Travel Group desde 1999.
          </p>
          <div className="footer-social" aria-label="Redes sociales de Mega Travel Perú">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${social.name} de Mega Travel Perú, abre otra pestaña`}
                title={social.name}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        <nav className="footer-nav-col" aria-label="Enlaces de la empresa">
          <h3 className="footer-heading">Mega Travel Perú</h3>
          <ul>
            {companyLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="footer-nav-col" aria-label="Destinos destacados">
          <h3 className="footer-heading">Nuestros destinos</h3>
          <ul>
            {destinationLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-contact-col">
          <h3 className="footer-heading">Contacto comercial</h3>
          <ul className="footer-contact-list">
            <li>
              <MapPin size={16} aria-hidden="true" />
              <span>Av. Alfredo Benavides 768, Miraflores, Lima, Perú</span>
            </li>
            <li>
              <Phone size={16} aria-hidden="true" />
              <span>
                <a href="tel:+5114800033">+51 (01) 480 0033</a>
                {" · "}
                <a href={contactUrl} target="_blank" rel="noopener noreferrer">
                  +51 973 473 808
                </a>
              </span>
            </li>
            <li>
              <Mail size={16} aria-hidden="true" />
              <a href="mailto:reservasweb@megatravel.pe">
                reservasweb@megatravel.pe
              </a>
            </li>
            <li>
              <Globe size={16} aria-hidden="true" />
              <a
                href="https://www.megatravel.pe/es/"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.megatravel.pe
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Megatravel Operadora del Perú S.A. Todos
          los derechos reservados.
        </span>
        <div className="footer-legal-links">
          <a
            href="https://www.megatravel.pe/privacyPolicyPage.xhtml"
            target="_blank"
            rel="noopener noreferrer"
          >
            Política de privacidad
          </a>
          <a href="/admin">Acceso al equipo</a>
        </div>
      </div>
    </footer>
  );
}
