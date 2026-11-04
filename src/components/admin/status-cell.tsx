import type { DefaultServerCellComponentProps } from "payload";
import { isPublishable } from "@/lib/lifecycle";
import { DepartureActions } from "./departure-actions";

export async function StatusCell({
  cellData,
  rowData,
  payload,
}: DefaultServerCellComponentProps) {
  const doc =
    cellData === "published" &&
    (!rowData.travelDate || rowData.advanceDays == null)
      ? await payload.findByID({
          collection: "departures",
          id: rowData.id,
          overrideAccess: true,
          depth: 0,
        })
      : rowData;
  const expired = cellData === "published" && !isPublishable(doc as any);
  return (
    <span>
      <span
        title={
          expired
            ? "El catálogo ya la oculta, aunque el retiro automático esté pendiente."
            : undefined
        }
      >
        {expired
          ? "Vencida · pendiente de retiro"
          : cellData === "published"
            ? "Publicado"
            : cellData === "withdrawn"
              ? "Retirado"
              : "Borrador"}
      </span>
      <DepartureActions
        id={rowData.id}
        status={cellData}
        program={rowData.program || "salida"}
      />
    </span>
  );
}
