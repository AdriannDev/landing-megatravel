// Preserve saved order/visibility and unrelated preferences while introducing the new column once.
export function departureSeatColumns(columns: { accessor: string; active: boolean; [key: string]: unknown }[]) {
  const existing = columns.find(c => c.accessor === 'availableSeats')
  const result = columns.filter(c => c.accessor !== 'availableSeats')
  const anchor = result.findIndex(c => c.accessor === 'origin')
  const date = result.findIndex(c => c.accessor === 'travelDate')
  result.splice(anchor >= 0 ? anchor + 1 : date >= 0 ? date + 1 : result.length, 0, { ...existing, accessor: 'availableSeats', active: true })
  return result
}
