"use client";
export function SeatCountCell({ cellData }: { cellData?: number | null }) {
  return <span>{cellData ?? 'Sin informar'}</span>;
}
