// Separate Railway cron service: */10 * * * *. Disabled until TI completes the access checks.
if (process.env.SEAT_MAIL_PILOT_ENABLED !== 'true') {
  console.log(JSON.stringify({ mode: 'simulation', status: 'disabled' }))
} else {
  const [{ getPayload }, { default: config }, { runMailPilot }] = await Promise.all([import('payload'), import('../src/payload.config'), import('../src/server/seat-mail-provider')])
  const payload = await getPayload({ config })
  try { console.log(JSON.stringify(await runMailPilot(payload))) }
  catch (error) { console.error((error as Error).message); process.exitCode = 1 }
  finally { await payload.destroy() }
}
export {}
