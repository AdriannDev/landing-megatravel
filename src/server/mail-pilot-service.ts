import { APIError, type PayloadRequest } from "payload";
import { sql } from "@payloadcms/db-postgres";
import {
  digest,
  eventKey,
  extractMailEvent,
  pilotMTPE,
  proposeMovement,
  reservationKey,
  type ReservationState,
} from "../lib/mail-pilot.ts";
import { inTransaction, lockCommercialRecords, postgresTransaction } from "./transactions.ts";
import { normalizeMTPE } from "../lib/programs.ts";
import { isDateOnly } from "../lib/lifecycle.ts";
import type { SeatPilotPool } from "../payload-types.ts";

// PostgreSQL serializes all pilot writes across workers. SQLite uses BEGIN IMMEDIATE.
// Keep this lock in the transaction which reads and writes the balances/cursors.
export async function lockMailPilot(req: PayloadRequest) {
  const transactionID = await req.transactionID;
  if (transactionID == null)
    throw new Error("El piloto requiere una transacción.");
  if (req.payload.db.name === "postgres") {
    await (
      await postgresTransaction(req)
    ).execute(sql`SELECT pg_advisory_xact_lock(721905204)`);
  } else if (req.payload.db.name !== "sqlite")
    throw new Error("Adaptador sin bloqueo de concurrencia para el piloto.");
}
export async function createPilotPool(
  req: PayloadRequest,
  input: { mtpe: string; initialSeats: number; cutoffAt: string },
) {
  if (req.user?.role !== "admin")
    throw new APIError(
      "Solo un administrador puede conciliar un saldo simulado.",
      403,
    );
  if (
    typeof input.mtpe !== "string" ||
    !Number.isSafeInteger(input.initialSeats) ||
    input.initialSeats < 0 ||
    input.initialSeats > 100_000 ||
    typeof input.cutoffAt !== "string" ||
    !isDateOnly(input.cutoffAt.slice(0, 10)) ||
    !/(Z|[+-]\d\d:\d\d)$/.test(input.cutoffAt) ||
    !Number.isFinite(Date.parse(input.cutoffAt)) ||
    Date.parse(input.cutoffAt) > Date.now()
  )
    throw new APIError(
      "Indica programa, saldo entero y fecha de corte pasada con zona horaria.",
      400,
    );
  return inTransaction(req, async () => {
    await lockMailPilot(req);
    const mtpe = pilotMTPE(input.mtpe);
    const existing = await req.payload.find({
      collection: "seat-pilot-pools",
      req,
      overrideAccess: true,
      where: { mtpe: { equals: mtpe } },
      limit: 1,
    });
    if (existing.docs.length)
      throw new APIError(
        "Ya existe un saldo inicial para este programa. No se reinicia un piloto con movimientos pendientes.",
        409,
      );
    const programs = await req.payload.find({
      collection: "programs",
      req,
      overrideAccess: true,
      depth: 0,
      where: {
        mtpe: { in: [normalizeMTPE(mtpe), normalizeMTPE(`MTPE-${mtpe}`)] },
      },
      limit: 2,
    });
    if (programs.docs.length !== 1)
      throw new APIError(
        "El código MTPE no identifica un único programa existente.",
        400,
      );
    const program = programs.docs[0];
    return req.payload.create({
      collection: "seat-pilot-pools",
      req,
      overrideAccess: true,
      data: {
        mtpe,
        programId: String(program.id),
        programCreatedAt: program.createdAt,
        programName: program.program,
        initialSeats: input.initialSeats,
        remainingSeats: input.initialSeats,
        cutoffAt: new Date(input.cutoffAt).toISOString(),
        actorLabel: req.user!.email || "Administrador",
      },
    });
  });
}
export type PilotMail = {
  id: string;
  mailbox: string;
  subject?: string;
  body: string;
  html?: boolean;
  trusted: boolean;
  reviewReason?: string;
};
export type LiveMailSettings = { cutoffAt: string; mtpes: string[] };

export async function processPilotMail(req: PayloadRequest, mail: PilotMail, live?: LiveMailSettings) {
  return inTransaction(req, async () => {
    await lockMailPilot(req);
    const namespace = live ? "live:" : "";
    const messageKey = digest(`${namespace}${mail.mailbox}:${mail.id}`);
    const seen = await req.payload.find({
      collection: "seat-mail-events",
      req,
      overrideAccess: true,
      where: { messageKey: { equals: messageKey } },
      limit: 1,
    });
    if (seen.docs[0]) return seen.docs[0];
    const extraction = mail.reviewReason ? { reason: mail.reviewReason } : mail.trusted
      ? extractMailEvent(mail)
      : { reason: "Remitente no autorizado. Revisa la procedencia del aviso." };
    const event = extraction.event;
    const fingerprint = event && (live ? digest(`live:${eventKey(event)}`) : eventKey(event));
    const save = (data: Record<string, unknown>) =>
      req.payload.create({
        collection: "seat-mail-events",
        req,
        overrideAccess: true,
        data: {
          messageKey,
          mtpe: event?.mtpe,
          reservation: event?.reservation,
          event: event && live ? { ...event, mode: "live" } : event,
          ...data,
        } as any,
      });
    if (!event) return save({ outcome: "review", reason: extraction.reason });
    const duplicate = await req.payload.find({
      collection: "seat-mail-events",
      req,
      overrideAccess: true,
      where: { eventKey: { equals: fingerprint } },
      limit: 1,
    });
    if (duplicate.docs.length)
      return save({
        outcome: "duplicate",
        duplicateOf: fingerprint,
        reason: "Evento ya recibido, incluido un posible reenvío.",
      });
    const review = (reason: string) =>
      save({ eventKey: fingerprint, outcome: "review", reason });
    if (Date.parse(event.occurredAt) > Date.now() + 5 * 60_000)
      return review(
        "La fecha del evento está en el futuro; revisa su orden antes de procesarlo.",
      );
    let pool: SeatPilotPool | undefined;
    if (live) {
      if (Date.parse(event.occurredAt) <= Date.parse(live.cutoffAt))
        return review("Aviso anterior o igual al inicio de la actualización de cupos reales.");
      if (live.mtpes.length && !live.mtpes.includes(event.mtpe))
        return review("Este MTPE está fuera del alcance de la actualización de cupos reales.");
    } else {
      pool = (await req.payload.find({
        collection: "seat-pilot-pools",
        req,
        overrideAccess: true,
        where: { mtpe: { equals: event.mtpe } },
        limit: 1,
      })).docs[0];
      if (!pool) return review("No existe un saldo inicial conciliado para este programa.");
    }
    const programs = await req.payload.find({
      collection: "programs",
      req,
      overrideAccess: true,
      depth: 0,
      where: {
        and: [
          ...(pool ? [{ id: { equals: pool.programId } }, { createdAt: { equals: pool.programCreatedAt } }] : []),
          {
            mtpe: {
              in: [
                normalizeMTPE(event.mtpe),
                normalizeMTPE(`MTPE-${event.mtpe}`),
              ],
            },
          },
        ],
      },
      limit: 2,
    });
    if (programs.docs.length !== 1)
      return review(live ? "El MTPE no identifica un único programa." : "El programa original fue eliminado o cambió de código.");
    let program = programs.docs[0];
    if (live) {
      // Read the balance again under the program's row lock before computing the delta.
      await lockCommercialRecords(req, "programs", [program.id]);
      const current = await req.payload.find({
        collection: "programs", req, overrideAccess: true, depth: 0, limit: 1,
        where: { and: [{ id: { equals: program.id } }, { createdAt: { equals: program.createdAt } }] },
      });
      if (!current.docs[0]) return review("El programa original fue eliminado.");
      program = current.docs[0];
    }
    const balanceBefore = pool?.remainingSeats ?? program.availableSeats;
    if (balanceBefore == null || !Number.isSafeInteger(balanceBefore) || balanceBefore < 0 || (live && program.seatsMigrationPending))
      return review("El programa necesita un saldo de cupos registrado y conciliado.");
    const departures = await req.payload.count({
      collection: "departures",
      req,
      overrideAccess: true,
      where: {
        and: [
          { programRef: { equals: program.id } },
          { travelDate: { equals: event.travelDate } },
        ],
      },
    });
    if (!departures.totalDocs)
      return review("No existe una salida del programa para esta fecha.");
    const key = live ? digest(`live:${program.id}:${program.createdAt}:${reservationKey(event)}`) : reservationKey(event);
    const reservations = await req.payload.find({
      collection: "seat-pilot-reservations",
      req,
      overrideAccess: true,
      where: { key: { equals: key } },
      limit: 1,
    });
    const previous = reservations.docs[0];
    const movement = proposeMovement(
      live ? { remainingSeats: balanceBefore, cutoffAt: live.cutoffAt } : pool!,
      previous?.state as ReservationState | undefined,
      event,
    );
    if (movement.reason) return review(movement.reason);
    const state = { ...event, eventKey: fingerprint!, ...(live ? { mode: "live" } : {}) };
    if (previous)
      await req.payload.update({
        collection: "seat-pilot-reservations",
        id: previous.id,
        req,
        overrideAccess: true,
        data: { state },
      });
    else
      await req.payload.create({
        collection: "seat-pilot-reservations",
        req,
        overrideAccess: true,
        data: { key, mtpe: event.mtpe, reservation: event.reservation, state },
      });
    if (pool) {
      await req.payload.update({
        collection: "seat-pilot-pools", id: pool.id, req, overrideAccess: true,
        data: { remainingSeats: movement.remainingSeats },
      });
    } else if (movement.delta) {
      await req.payload.update({
        collection: "programs", id: program.id, req, overrideAccess: true,
        data: { availableSeats: movement.remainingSeats },
      });
      await req.payload.create({
        collection: "audit-log", req, overrideAccess: true,
        data: {
          entityType: "program", programId: String(program.id), program: program.program,
          event: "updated", actorLabel: "Automatización de cupos por Gmail",
          changes: { availableSeats: { before: balanceBefore, after: movement.remainingSeats }, reservation: event.reservation, mailEventKey: fingerprint },
        },
      });
    }
    return save({
      eventKey: fingerprint,
      outcome: "proposed",
      reason: live
        ? movement.delta ? "Movimiento aplicado a los cupos reales del programa." : "Aviso registrado. El saldo real conserva la misma cantidad."
        : "Movimiento aplicado únicamente al saldo simulado.",
      delta: movement.delta,
      balanceBefore,
      balanceAfter: movement.remainingSeats,
    });
  });
}
