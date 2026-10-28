import { redirect } from 'next/navigation'
import { departureViewURL } from '@/lib/admin-views'

export function AdminHome() { redirect(departureViewURL('published')) }
