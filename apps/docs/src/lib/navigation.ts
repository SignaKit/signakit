export function getSection(path: string | undefined) {
  if (!path) return 'flags'
  const [dir] = path.split('/', 1)
  if (!dir) return 'flags'

  return (
    {
      events: 'events',
    }[dir] ?? 'flags'
  )
}
