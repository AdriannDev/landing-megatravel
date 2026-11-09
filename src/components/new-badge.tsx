export function NewBadge({ label }: { label: string }) {
  return (
    <span className="new-badge" title={label}>
      <span className="new-badge-text">{label}</span>
    </span>
  );
}

export const durationLabel = (days: number, nights?: number | null) =>
  `${days} ${days === 1 ? "día" : "días"}` +
  (nights != null ? ` / ${nights} ${nights === 1 ? "noche" : "noches"}` : "");
