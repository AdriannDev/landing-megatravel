import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { NewDeparture } from './new-departure'
import { redirect } from 'next/navigation'

export function NewDepartureView(props: AdminViewServerProps) {
  const { initPageResult: { req, permissions, visibleEntities }, params, searchParams } = props
  if (!req.user || !['editor', 'admin'].includes(String(req.user.role))) redirect('/admin/login')
  return <DefaultTemplate req={req} i18n={req.i18n} locale={props.initPageResult.locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user || undefined} visibleEntities={visibleEntities}><Gutter><NewDeparture/></Gutter></DefaultTemplate>
}
