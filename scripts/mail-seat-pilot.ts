// Separate Railway cron service: */10 * * * *. Disabled until TI completes the access checks.
if (process.env.SEAT_MAIL_PILOT_ENABLED !== 'true') {
  console.log(JSON.stringify({ mode: 'simulation', status: 'disabled' }))
} else {
  try {
    const [{ withMailPilotPayload }, { default: config }, { runMailPilot }] = await Promise.all([
      import('./mail-pilot-payload.ts'),
      import('../src/payload.config'),
      import('../src/server/seat-mail-provider'),
    ])
    const result = await withMailPilotPayload(config, runMailPilot)
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error((error as Error).message)
    process.exitCode = 1
  }
}
export {}
