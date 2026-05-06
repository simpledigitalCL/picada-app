export function logApiEvent(
  route: string,
  event: string,
  meta: Record<string, unknown> = {},
): void {
  try {
    const payload = {
      ts: new Date().toISOString(),
      route,
      event,
      ...meta,
    }
    console.info(JSON.stringify(payload))
  } catch {
    // no-op
  }
}
