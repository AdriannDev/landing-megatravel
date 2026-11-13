import { APIError, type PayloadRequest } from "payload";
import { sql } from "@payloadcms/db-postgres";
import {
  digest,
  eventKey,
  extractMailEvent,
  pilotMTPE,
  proposeMovement,
  reservationKey,
  isActiveReservation,
  mailTimestamp,
  resolveMailDeparture,
  type MailExtraction,
  type MailOrder,
  type ReservationState,
} from "../lib/mail-pilot.ts";
import { inTransaction, postgresTransaction } from "./transactions.ts";
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
  input: { mtpe: string; initialSeats: number; cutoffAt: string; travelDate?: string; origin?: string; departureStableId?: string },
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
    const departures = await req.payload.find({ collection: 'departures', req, overrideAccess: true, depth: 1, pagination: false, where: { programRef: { equals: program.id } } })
    const resolved = resolveMailDeparture(input.departureStableId ? departures.docs.filter(d => d.stableId === input.departureStableId) : departures.docs, input)
    if (!resolved.departure) throw new APIError(resolved.reason || 'Selecciona una salida.', 400)
    const departure = resolved.departure
    const existing = await req.payload.find({ collection: 'seat-pilot-pools', req, overrideAccess: true, where: { departureStableId: { equals: departure.stableId } }, limit: 1 })
    if (existing.docs.length) throw new APIError('Ya existe un saldo inicial para esta salida.', 409)
    return req.payload.create({
      collection: "seat-pilot-pools",
      req,
      overrideAccess: true,
      data: {
        mtpe,
        departureStableId: departure.stableId,
        travelDate: departure.travelDate,
        origin: typeof departure.origin === 'object' ? departure.origin.name : String(departure.origin),
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
  extraction?: MailExtraction;
  sender?: string;
  receivedAt?: string;
  sourceMessageId?: string;
  order?: MailOrder;
};
export type LiveMailSettings = { cutoffAt: string; mtpes: string[] };

export async function processPilotMail(req: PayloadRequest, mail: PilotMail, live?: LiveMailSettings) {
  return inTransaction(req, async () => {
    await lockMailPilot(req);
    const namespace = live ? "live:" : "";
    const messageKey = digest(`${namespace}${mail.mailbox}:${mail.id}`);
    const sourceKey = mail.trusted && !mail.reviewReason && mail.sourceMessageId ? digest(`${namespace}${mail.mailbox}:source:${mail.sourceMessageId}`) : undefined;
    const seen = await req.payload.find({
      collection: "seat-mail-events",
      req,
      overrideAccess: true,
      where: { or: [{ messageKey: { equals: messageKey } }, ...(sourceKey ? [{ sourceKey: { equals: sourceKey } }] : [])] },
      limit: 1,
    });
    if (seen.docs[0]) return seen.docs[0];
    const extraction = mail.extraction || extractMailEvent(mail);
    const blockingReason = !mail.trusted ? mail.reviewReason || "Remitente no autorizado. Revisa la procedencia del aviso." : mail.reviewReason || extraction.reason;
    const receivedAt = mailTimestamp(mail.receivedAt);
    const event = extraction.event && { ...extraction.event, ...(receivedAt ? { receivedAt } : {}), ...(mail.order ? { order: mail.order } : {}) };
    const fields = extraction.fields;
    const businessFingerprint = event?.reservation && (event.version != null || event.occurredAt) ? eventKey(event) : messageKey;
    const fingerprint = event && (live ? digest(`live:${businessFingerprint}`) : businessFingerprint);
    const save = (data: Record<string, unknown>) =>
      req.payload.create({
        collection: "seat-mail-events",
        req,
        overrideAccess: true,
        data: {
          messageKey,
          sourceKey,
          subject: mail.subject?.slice(0, 1000),
          sender: mail.sender?.slice(0, 320),
          receivedAt,
          mtpe: fields.mtpe,
          reservation: fields.reservation,
          seats: fields.seats,
          status: fields.status,
          travelDate: fields.travelDate,
          origin: fields.origin,
          resolvedDeparture: event?.departureStableId,
          occurredAt: fields.occurredAt,
          version: fields.version,
          event: { ...(event || fields), ...(live ? { mode: "live" } : {}) },
          ...data,
        } as any,
      });
    if (blockingReason || !event) return save({ outcome: "review", observation: "blocked", reason: blockingReason || "Datos principales ausentes." });
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
      save({ eventKey: fingerprint, outcome: "review", observation: "blocked", reason });
    if (event.occurredAt && Date.parse(event.occurredAt) > Date.now() + 5 * 60_000)
      return review(
        "La fecha del evento está en el futuro; revisa su orden antes de procesarlo.",
      );
    if (live) {
      if ((event.occurredAt || receivedAt) && Date.parse((event.occurredAt || receivedAt)!) <= Date.parse(live.cutoffAt)) return review('Aviso anterior o igual al inicio de la actualización de cupos reales.')
      if (live.mtpes.length && !live.mtpes.includes(event.mtpe)) return review('Este MTPE está fuera del alcance de la actualización de cupos reales.')
    }
    const programs = await req.payload.find({ collection: 'programs', req, overrideAccess: true, depth: 0, limit: 2, where: { mtpe: { in: [normalizeMTPE(event.mtpe), normalizeMTPE(`MTPE-${event.mtpe}`)] } } })
    if (programs.docs.length !== 1) return review('El MTPE no identifica un ?nico programa existente.')
    const program = programs.docs[0]
    const departures = await req.payload.find({ collection: 'departures', req, overrideAccess: true, depth: 1, pagination: false, where: { programRef: { equals: program.id } }, context: { skipProgramResolution: true } })
    const resolved = resolveMailDeparture(departures.docs, event)
    if (!resolved.departure) return review(resolved.reason!)
    const departure = resolved.departure
    if (!departure.stableId) return review('La salida no tiene una identidad estable. Revisa su carga.')
    event.travelDate = departure.travelDate
    event.origin = typeof departure.origin === 'object' ? departure.origin.name : String(departure.origin)
    fields.travelDate = event.travelDate; fields.origin = event.origin
    event.departureStableId = departure.stableId
    event.originId = String(typeof departure.origin === 'object' ? departure.origin.id : departure.origin)
    event.programId = String(program.id); event.programCreatedAt = program.createdAt
    if (!event.reservation && !isActiveReservation(event.status)) return review('Cancelación sin localizador: no se puede identificar una reserva para devolver cupos.')
    const key = digest(`${namespace}${program.id}:${program.createdAt}:${reservationKey(event)}`)
    const reservationAliases = event.reservation?.startsWith('MTP-') ? [event.reservation, event.reservation.slice(4)] : [event.reservation!]
    const reservations = event.reservation ? await req.payload.find({ collection: 'seat-pilot-reservations', req, overrideAccess: true, where: { and: [{ mtpe: { equals: event.mtpe } }, { reservation: { in: reservationAliases } }] }, pagination: false }) : undefined
    const relevantReservations = reservations?.docs.filter(r => ((r.state as any)?.mode === 'live') === !!live)
    const previous = relevantReservations?.find(r => r.key === key)
    if (!previous && relevantReservations?.length) return review('Existe historial de esta reserva ligado a otro programa original. Requiere conciliación manual.')
    const previousState = previous?.state as ReservationState | undefined
    if (previousState && (!previousState.departureStableId || previousState.programId !== String(program.id) || previousState.programCreatedAt !== program.createdAt)) return review('La reserva histórica no identifica una salida original inequívoca.')
    const previousDeparture = previousState && departures.docs.find(d => d.stableId === previousState.departureStableId)
    if (previousState && (!previousDeparture || previousDeparture.travelDate !== previousState.travelDate || String(typeof previousDeparture.origin === 'object' ? previousDeparture.origin.id : previousDeparture.origin) !== previousState.originId)) return review('La salida original de la reserva fue eliminada o cambió de identidad.')
    const transfer = previousState && previousState.departureStableId !== departure.stableId
    if (transfer && !isActiveReservation(event.status)) return review('La salida de la cancelación contradice la salida ocupada por la reserva.')
    const poolFor = async (doc: typeof departure) => {
      if (live) return undefined
      const found = await req.payload.find({ collection: 'seat-pilot-pools', req, overrideAccess: true, depth: 0, limit: 1, where: { departureStableId: { equals: doc.stableId } } })
      const pool = found.docs[0]
      return pool?.programId === String(program.id) && pool.programCreatedAt === program.createdAt ? pool : undefined
    }
    const pool = await poolFor(departure)
    const sourcePool = transfer ? await poolFor(previousDeparture!) : undefined
    if (!live && (!pool || transfer && !sourcePool)) return review('No existe un saldo inicial conciliado para la salida original. No se reutilizan saldos de programas recreados.')
    const balance = (doc: typeof departure, simulated?: SeatPilotPool) => simulated?.remainingSeats ?? doc.availableSeats
    const cutoff = (doc: typeof departure, simulated?: SeatPilotPool) => simulated?.cutoffAt || doc.seatsReconciledAt
    const balanceBefore = balance(departure, pool)
    const cutoffAt = cutoff(departure, pool)
    if (balanceBefore == null || !Number.isSafeInteger(balanceBefore) || balanceBefore < 0 || !cutoffAt) return review('La salida necesita un saldo de cupos registrado y conciliado.')
    if (!event.occurredAt && !event.receivedAt) return review('Falta la fecha comercial o de recepción para comprobar la conciliación de la salida.')
    const movement = proposeMovement({ remainingSeats: balanceBefore, cutoffAt }, transfer ? { ...previousState!, occupiedSeats: 0 } : previousState, event)
    if (movement.reason) return review(movement.reason)
    const occupied = previousState?.occupiedSeats ?? (previousState && isActiveReservation(previousState.status) ? previousState.seats : 0)
    let sourceBefore: number | null | undefined, sourceAfter: number | undefined
    if (transfer) {
      sourceBefore = balance(previousDeparture!, sourcePool)
      const sourceCutoff = cutoff(previousDeparture!, sourcePool)
      if (sourceBefore == null || !sourceCutoff || !Number.isSafeInteger(sourceBefore)) return review('La salida original necesita conciliación antes del traslado.')
      const release = proposeMovement({ remainingSeats: sourceBefore, cutoffAt: sourceCutoff }, previousState, { ...event, status: 'cancelled', seats: occupied || 0 })
      if (release.reason) return review(release.reason)
      sourceAfter = release.remainingSeats
    }
    const movements: { departureStableId: string; travelDate: string; origin: string; before: number; after: number; delta: number }[] = []
    const updateBalance = async (doc: typeof departure, simulated: SeatPilotPool | undefined, before: number, after: number) => {
      movements.push({ departureStableId: doc.stableId!, travelDate: doc.travelDate, origin: typeof doc.origin === 'object' ? doc.origin.name : String(doc.origin), before, after, delta: after - before })
      if (simulated) await req.payload.update({ collection: 'seat-pilot-pools', id: simulated.id, req, overrideAccess: true, data: { remainingSeats: after } })
      else if (before !== after) {
        const previousContext = req.context
        try { await req.payload.update({ collection: 'departures', id: doc.id, req, overrideAccess: true, data: { availableSeats: after }, context: { seatMailMovement: true, skipProgramResolution: true } }) }
        finally { req.context = previousContext }
      }
    }
    if (transfer) await updateBalance(previousDeparture!, sourcePool, sourceBefore!, sourceAfter!)
    await updateBalance(departure, pool, balanceBefore, movement.remainingSeats!)
    const active = isActiveReservation(event.status)
    const state = { ...event, version: event.version ?? previousState?.version, occurredAt: event.occurredAt ?? previousState?.occurredAt, receivedAt: event.receivedAt ?? previousState?.receivedAt, order: event.order ?? previousState?.order, occupiedSeats: active ? event.seats : 0, lastActiveSeats: active ? event.seats : previousState?.lastActiveSeats ?? previousState?.seats, eventKey: fingerprint!, ...(live ? { mode: 'live' } : {}) }
    if (event.reservation && previous) await req.payload.update({ collection: 'seat-pilot-reservations', id: previous.id, req, overrideAccess: true, data: { state } })
    else if (event.reservation) await req.payload.create({ collection: 'seat-pilot-reservations', req, overrideAccess: true, data: { key, mtpe: event.mtpe, reservation: event.reservation, state } })
    return save({ eventKey: fingerprint, outcome: 'proposed', ...(!event.reservation ? { observation: 'warning' } : {}),
      resolvedDeparture: departure.stableId, movements,
      reason: (!event.reservation ? 'Advertencia: sin localizador. Se aplicó por mensaje; no se vinculará automáticamente con otros avisos. ' : '') + (live ? transfer ? 'Traslado aplicado a ambas salidas.' : 'Movimiento aplicado a los cupos reales de esta salida.' : 'Movimiento aplicado únicamente a los saldos simulados por salida.'),
      delta: movement.delta, balanceBefore, balanceAfter: movement.remainingSeats,
    })
  })
}
