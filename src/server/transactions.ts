import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'

export async function inTransaction<T>(req: PayloadRequest, run: () => Promise<T>): Promise<T> {
  const owned = await initTransaction(req)
  if (!req.transactionID || await req.transactionID == null) throw new Error('La base debe admitir transacciones para crear salidas sin registros parciales.')
  try {
    const result = await run()
    if (owned) await commitTransaction(req)
    return result
  } catch (error) {
    if (owned) await killTransaction(req)
    throw error
  }
}
