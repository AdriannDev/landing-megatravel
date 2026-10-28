import type { DefaultServerCellComponentProps } from 'payload'

// Payload's default relationship cell expects IDs. Resolved program projections may
// contain populated documents, so display either representation in the same column.
export async function ReferenceCell({ cellData, field, payload }: DefaultServerCellComponentProps) {
  if (!cellData || !('relationTo' in field) || typeof field.relationTo !== 'string') return <span>—</span>
  const doc = typeof cellData === 'object' ? cellData : await payload.findByID({ collection: field.relationTo, id: cellData, overrideAccess: true, depth: 0 })
  return <span>{String(doc.name || doc.program || doc.alt || doc.id)}</span>
}
