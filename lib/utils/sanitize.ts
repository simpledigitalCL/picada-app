export function sanitizeUserText(input: unknown): string {
  const raw = typeof input === 'string' ? input : String(input ?? '')
  if (!raw) return ''

  // Browser-safe path: leverage DOM parsing to extract only text.
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(raw, 'text/html')
    return (doc.body.textContent || '').trim()
  }

  // Server path (SSR / API): strip dangerous blocks and remaining HTML tags.
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim()
}
