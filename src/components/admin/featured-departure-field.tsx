import type { RelationshipFieldServerProps } from 'payload'
import { departureSelectionLabel } from '@/lib/admin-views'
import { FeaturedDepartureSelect } from './featured-departure-select'

export async function FeaturedDepartureField({ req, path, clientField, readOnly }: RelationshipFieldServerProps) {
  const { docs } = await req.payload.find({ collection: 'departures', req, overrideAccess: false, depth: 1, pagination: false, sort: 'travelDate' })
  const options = docs.map(doc => ({
    value: String(doc.id),
    label: departureSelectionLabel({ program: doc.program || 'Sin programa', mtpe: doc.mtpe || '', date: doc.travelDate, origin: doc.origin && typeof doc.origin === 'object' ? doc.origin.name : '' }),
  }))
  return <FeaturedDepartureSelect path={path} label={clientField.label} options={options} readOnly={readOnly} />
}
