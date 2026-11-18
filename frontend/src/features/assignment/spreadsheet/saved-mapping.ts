import type { SheetSelection } from './sheet-selection'
import { fields } from './mapping'
import { headers, type Workbook } from './workbook'
const storageKey = 'orchestrata.assignment-columns.v1'
const key = (value: string) => value.normalize('NFC').trim().toLowerCase()
type Saved = { jobs: Record<string, string>; people: Record<string, string> }
export function saveMapping(book: Workbook, mapping: SheetSelection): boolean {
  const saved: Saved = { jobs: {}, people: {} }
  for (const group of ['jobs', 'people'] as const) {
    const selected = mapping[group] as unknown as Record<string, number | null>
    if (selected.sheet === null) return false
    const names = headers(book.sheets[selected.sheet]).map(key)
    for (const field of fields[group]) {
      const column = selected[field]
      if (
        column === null ||
        !names[column] ||
        names.filter((name) => name === names[column]).length !== 1
      )
        return false
      saved[group][field] = names[column]
    }
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved))
    return true
  } catch {
    return false
  }
}
export function restoreMapping(book: Workbook, proposed: SheetSelection): SheetSelection {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!raw || typeof raw !== 'object') return proposed
    const saved = raw as Saved
    const next = structuredClone(proposed)
    for (const group of ['jobs', 'people'] as const) {
      if (!saved[group] || fields[group].some((field) => typeof saved[group][field] !== 'string'))
        continue
      const matches = book.sheets.flatMap((sheet, index) => {
        const names = headers(sheet).map(key)
        const found = fields[group].map((field) =>
          names.flatMap((name, col) => (name === saved[group][field] ? [col] : [])),
        )
        return found.every((list) => list.length === 1)
          ? [
              {
                sheet: index,
                ...Object.fromEntries(fields[group].map((field, i) => [field, found[i][0]])),
              },
            ]
          : []
      })
      if (matches.length === 1) Object.assign(next[group], matches[0])
    }
    return next
  } catch {
    return proposed
  }
}
