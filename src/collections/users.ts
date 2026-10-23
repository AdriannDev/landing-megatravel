import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { adminField, isAdmin } from '../server/access'
export const Users: CollectionConfig = {
  slug: 'users', labels: { singular: 'Usuario', plural: 'Usuarios' },
  auth: { tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000 },
  admin: { useAsTitle: 'email', group: 'Configuración', defaultColumns: ['name', 'email', 'role'] },
  access: {
    admin: ({ req }) => !!req.user && ['admin', 'editor'].includes(String(req.user.role)),
    create: isAdmin,
    read: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: isAdmin,
  },
  hooks: { beforeChange: [({ data, req, context }) => {
    if (!req.user && !context.bootstrap) throw new APIError('Crea el primer administrador con el comando de configuración privada.', 403)
    return data
  }] },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'role', label: 'Rol', type: 'select', required: true, defaultValue: 'editor', access: { create: adminField, update: adminField }, options: [{ label: 'Administrador', value: 'admin' }, { label: 'Editor', value: 'editor' }] },
  ],
}
