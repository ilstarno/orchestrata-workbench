import { ImportError } from './workbook'

// Preserves quoted newlines, empty cells and physical source row positions.
function parse(text: string, separator: string): string[][] {
  let value = '', row: string[] = [], quoted = false, closed = false
  const rows: string[][] = []
  function cell() {
    if (row.length >= 80 || value.length > 8192) throw new ImportError('sheet-limit')
    row.push(value); value = ''; closed = false
  }
  function record() {
    cell()
    if (rows.length >= 204) throw new ImportError('sheet-limit')
    rows.push(row); row = []
  }
  for (let i = text.charCodeAt(0) === 65279 ? 1 : 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char !== '"') value += char
      else if (text[i + 1] === '"') { value += '"'; i++ }
      else { quoted = false; closed = true }
    } else if (char === separator) cell()
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++
      record()
    } else {
      if (closed || char === '"' && value !== '') throw new ImportError('invalid-file')
      if (char === '"') quoted = true
      else value += char
    }
    if (value.length > 8192) throw new ImportError('sheet-limit')
  }
  if (quoted) throw new ImportError('invalid-file')
  if (value || row.length || closed) record()
  return rows
}
export function readCsv(text: string): string[][] {
  if (text.includes('\0')) throw new ImportError('invalid-file')
  const failures: unknown[] = []
  const candidates = [',', ';'].flatMap(separator => {
    try {
      const rows = parse(text, separator)
      const nonblank = rows.filter(row => row.some(cell => cell.trim()))
      const consistent = nonblank.slice(0, 4).some((row, i) => row.length >= 2 && (nonblank.length - i >= 2 || nonblank.length === 1 && i === 0) && nonblank.slice(i).every(next => next.length === row.length))
      return consistent ? [rows] : []
    } catch (error) { failures.push(error); return [] }
  })
  if (failures.some(error => error instanceof ImportError && error.code === 'sheet-limit')) throw new ImportError('sheet-limit')
  if (candidates.length !== 1) throw new ImportError('delimiter')
  return candidates[0]
}
