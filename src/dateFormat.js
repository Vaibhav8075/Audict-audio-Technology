export function parseDateTime(dateStr, isUTC = false) {
  if (!dateStr) return null
  let normalized = dateStr
  if (typeof normalized === 'string') {
    normalized = normalized.trim()
    if (normalized.includes(' ') && !normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T')
    }
    if (isUTC) {
      if (!normalized.endsWith('Z') && !normalized.match(/[+-]\d{2}:?\d{2}$/)) {
        normalized = normalized + 'Z'
      }
    }
  }
  return new Date(normalized)
}

export function formatDateTime(dateStr, isUTC = false) {
  const d = parseDateTime(dateStr, isUTC)
  return d ? d.toLocaleString() : 'N/A'
}

export function formatDate(dateStr, isUTC = false) {
  const d = parseDateTime(dateStr, isUTC)
  return d ? d.toLocaleDateString() : 'N/A'
}
