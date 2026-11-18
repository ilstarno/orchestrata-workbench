import { extractRecords } from './input-model'

/** Reject duplicate keys and excessive nesting before normalizing named records. */
export function parseRecords(text: string) {
  JSON.parse(text)
  let cursor = 0
  const space = () => {
    while (/\s/.test(text[cursor] ?? '') && cursor < text.length) cursor++
  }
  function string() {
    const start = cursor++
    while (cursor < text.length) {
      if (text[cursor] === '\\') cursor += 2
      else if (text[cursor++] === '"') return JSON.parse(text.slice(start, cursor)) as string
    }
    throw new Error('Invalid string')
  }
  function value(depth: number): void {
    if (depth > 16) throw new Error('Nesting limit')
    space()
    if (text[cursor] === '"') {
      string()
      return
    }
    if (text[cursor] === '{') {
      cursor++
      space()
      const keys = new Set<string>()
      while (text[cursor] !== '}') {
        const key = string()
        if (keys.has(key)) throw new Error('Duplicate key')
        keys.add(key)
        space()
        cursor++
        value(depth + 1)
        space()
        if (text[cursor] !== ',') break
        cursor++
        space()
      }
      cursor++
      return
    }
    if (text[cursor] === '[') {
      cursor++
      space()
      while (text[cursor] !== ']') {
        value(depth + 1)
        space()
        if (text[cursor] !== ',') break
        cursor++
        space()
      }
      cursor++
      return
    }
    while (cursor < text.length && !/[\s,}\]]/.test(text[cursor])) cursor++
  }
  value(0)
  return extractRecords(JSON.parse(text))
}

export async function readRecords(file: File) {
  if (!/\.json$/i.test(file.name) || file.size > 524288) throw new Error('Invalid records file')
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > 524288) throw new Error('Records file limit')
  return parseRecords(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
}
