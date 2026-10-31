export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(totalSeconds, 0)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
