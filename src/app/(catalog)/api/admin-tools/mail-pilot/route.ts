import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AdminError, requireEditor } from "@/server/admin-auth";
import { createPilotPool, processPilotMail } from "@/server/mail-pilot-service";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { req, user } = await requireEditor(request, true);
    if (user.role !== "admin")
      throw new AdminError(
        "Solo un administrador puede gestionar el piloto.",
        403,
      );
    const body = await request.json();
    const result =
      body.action === "baseline"
        ? await createPilotPool(req, body)
        : body.action === "simulate" &&
            typeof body.body === "string" &&
            body.body.length <= 100_000
          ? await processPilotMail(req, {
              id: randomUUID(),
              mailbox: "manual-anonymized",
              body: body.body,
              trusted: true,
            })
          : null;
    if (!result) throw new AdminError("Operación o mensaje no válido.", 400);
    return NextResponse.json(
      { mode: "simulation", result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      {
        status: (error as { status?: number }).status || 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
