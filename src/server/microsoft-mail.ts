import { randomUUID } from "node:crypto";
import { createLocalReq, type Payload } from "payload";
import { digest } from "../lib/mail-pilot.ts";
import { inTransaction } from "./transactions.ts";
import { lockMailPilot, processPilotMail } from "./mail-pilot-service.ts";

type MailConfig = {
  tenant: string;
  client: string;
  secret: string;
  mailbox: string;
  folder: string;
  senders: string[];
};
type GraphMessage = {
  id?: string;
  from?: { emailAddress?: { address?: string } };
  subject?: string;
  receivedDateTime?: string;
  internetMessageId?: string;
  body?: { contentType?: string; content?: string };
  "@removed"?: unknown;
};
type GraphPage = {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};
type Fetch = typeof fetch;
const ROOT = "https://graph.microsoft.com/v1.0";
export function microsoftMailConfig(): MailConfig {
  const names = [
    "MS_TENANT_ID",
    "MS_CLIENT_ID",
    "MS_CLIENT_SECRET",
    "MS_MAILBOX_ID",
    "MS_MAIL_FOLDER_ID",
    "SEAT_MAIL_ALLOWED_SENDERS",
  ] as const;
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length)
    throw new Error(`Falta configurar el piloto: ${missing.join(", ")}.`);
  const tenant = process.env.MS_TENANT_ID!.trim();
  if (!/^[a-z0-9.-]+$/i.test(tenant))
    throw new Error("MS_TENANT_ID no válido.");
  const senders = process.env
    .SEAT_MAIL_ALLOWED_SENDERS!.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (
    !senders.length ||
    senders.some((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  )
    throw new Error(
      "Configura direcciones completas en SEAT_MAIL_ALLOWED_SENDERS.",
    );
  return {
    tenant,
    client: process.env.MS_CLIENT_ID!.trim(),
    secret: process.env.MS_CLIENT_SECRET!,
    mailbox: process.env.MS_MAILBOX_ID!.trim(),
    folder: process.env.MS_MAIL_FOLDER_ID!.trim(),
    senders,
  };
}
function folderURL(config: MailConfig) {
  return `${ROOT}/users/${encodeURIComponent(config.mailbox)}/mailFolders/${encodeURIComponent(config.folder)}/messages/delta`;
}
export function validateGraphCursor(
  cursor: string,
  config: Pick<MailConfig, "mailbox" | "folder">,
) {
  const url = new URL(cursor),
    expected = new URL(folderURL(config as MailConfig));
  if (
    url.origin !== expected.origin ||
    url.pathname !== expected.pathname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "El cursor de Microsoft no corresponde al buzón y carpeta configurados.",
    );
  return url.toString();
}
class GraphFailure extends Error {
  constructor(public status: number) {
    super(`Microsoft no completó la lectura (HTTP ${status}).`);
  }
}
async function accessToken(config: MailConfig, fetcher: Fetch) {
  const response = await fetcher(
    `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.client,
        client_secret: config.secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!response.ok) throw new GraphFailure(response.status);
  const body = await response.json();
  if (typeof body.access_token !== "string" || !body.access_token)
    throw new Error("Microsoft no devolvió una credencial de acceso.");
  return body.access_token as string;
}
export async function syncMicrosoftMailbox(
  payload: Payload,
  config: MailConfig = microsoftMailConfig(),
  fetcher: Fetch = fetch,
) {
  const key = digest(
      `${config.tenant}:${config.mailbox.toLowerCase()}:${config.folder}`,
    ),
    owner = randomUUID();
  const transact = async <T>(
    run: (req: Awaited<ReturnType<typeof createLocalReq>>) => Promise<T>,
  ) => {
    const req = await createLocalReq({}, payload);
    return inTransaction(req, async () => {
      await lockMailPilot(req);
      return run(req);
    });
  };
  const claimed = await transact(async (req) => {
    const found = await payload.find({
      collection: "mail-sync-cursors",
      req,
      overrideAccess: true,
      where: { key: { equals: key } },
      limit: 1,
    });
    const state = found.docs[0];
    if (state?.leaseUntil && Date.parse(state.leaseUntil) > Date.now())
      return null;
    const data = {
      key,
      owner,
      leaseUntil: new Date(Date.now() + 9 * 60_000).toISOString(),
    };
    return state
      ? payload.update({
          collection: "mail-sync-cursors",
          id: state.id,
          req,
          overrideAccess: true,
          data,
        })
      : payload.create({
          collection: "mail-sync-cursors",
          req,
          overrideAccess: true,
          data,
        });
  });
  if (!claimed)
    return { mode: "simulation", status: "busy", pages: 0, processed: 0 };
  let resetCursor = false,
    pages = 0,
    processed = 0;
  try {
    const token = await accessToken(config, fetcher);
    let cursor =
      claimed.cursor ||
      `${folderURL(config)}?$select=id,from,subject,body,receivedDateTime,internetMessageId&$top=50`;
    // A bounded run exits cleanly; the next run resumes the persisted nextLink.
    while (pages < 10) {
      const response = await fetcher(validateGraphCursor(cursor, config), {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        resetCursor = response.status === 410;
        throw new GraphFailure(response.status);
      }
      const page: GraphPage = await response.json();
      if (!Array.isArray(page.value))
        throw new Error("Respuesta incremental de Microsoft no válida.");
      const next = page["@odata.nextLink"] || page["@odata.deltaLink"];
      if (!next)
        throw new Error("Microsoft no devolvió el progreso de lectura.");
      validateGraphCursor(next, config);
      // The page and checkpoint commit together. A crash replays safely by message/event fingerprints.
      await transact(async (req) => {
        const current = await payload.findByID({
          collection: "mail-sync-cursors",
          id: claimed.id,
          req,
          overrideAccess: true,
        });
        if (
          current.owner !== owner ||
          !current.leaseUntil ||
          Date.parse(current.leaseUntil) <= Date.now()
        )
          throw new Error(
            "La ejecución perdió la reserva del lector; se retomará en la siguiente tarea.",
          );
        for (const message of page.value!) {
          if (message["@removed"]) continue; // Deleting an email never cancels a booking.
          if (!message.id)
            throw new Error("Microsoft devolvió un mensaje sin identificador.");
          const sender =
            message.from?.emailAddress?.address?.toLowerCase() || "";
          await processPilotMail(req, {
            id: message.id,
            mailbox: key,
            subject: message.subject,
            sender,
            receivedAt: message.receivedDateTime,
            sourceMessageId: message.internetMessageId,
            body: message.body?.content || "",
            html: message.body?.contentType?.toLowerCase() === "html",
            trusted: config.senders.includes(sender),
          });
          processed++;
        }
        await payload.update({
          collection: "mail-sync-cursors",
          id: claimed.id,
          req,
          overrideAccess: true,
          data: {
            cursor: next,
            lastSuccessAt: new Date().toISOString(),
            leaseUntil: new Date(Date.now() + 9 * 60_000).toISOString(),
          },
        });
      });
      pages++;
      cursor = next;
      if (!page["@odata.nextLink"]) break;
    }
    return { mode: "simulation", status: "read", pages, processed };
  } finally {
    await transact(async (req) => {
      const current = await payload.findByID({
        collection: "mail-sync-cursors",
        id: claimed.id,
        req,
        overrideAccess: true,
      });
      if (current.owner === owner)
        await payload.update({
          collection: "mail-sync-cursors",
          id: claimed.id,
          req,
          overrideAccess: true,
          data: {
            owner: null,
            leaseUntil: null,
            ...(resetCursor ? { cursor: null } : {}),
          },
        });
    });
  }
}
export async function runMicrosoftMailPilot(payload: Payload) {
  if (process.env.SEAT_MAIL_PILOT_ENABLED !== "true")
    return { mode: "simulation", status: "disabled" };
  return syncMicrosoftMailbox(payload);
}
