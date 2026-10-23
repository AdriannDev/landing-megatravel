import type { Access, FieldAccess } from 'payload'
export const isEditor: Access = ({ req }) => !!req.user && ['admin', 'editor'].includes(String(req.user.role))
export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const adminField: FieldAccess = ({ req }) => req.user?.role === 'admin'
export const editorField: FieldAccess = ({ req }) => !!req.user && ['admin', 'editor'].includes(String(req.user.role))
export const never: Access = () => false
export const contentAccess = { read: isEditor, create: isEditor, update: isEditor, delete: isEditor }
