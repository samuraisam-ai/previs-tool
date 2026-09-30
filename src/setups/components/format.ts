// Short relative dates for cards: "just now", "3 h ago", "12 Sep".
export function when(time: number): string {
  const minutes = (Date.now() - time) / 60000
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${Math.floor(minutes)} min ago`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: minutes > 60 * 24 * 300 ? 'numeric' : undefined })
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fileSafe = (name: string) => name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'production'
