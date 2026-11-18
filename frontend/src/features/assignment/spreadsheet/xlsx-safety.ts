import { ImportError } from './workbook'
const invalid = () => {
  throw new ImportError('invalid-file')
}
const decoder = new TextDecoder('utf-8', { fatal: true })
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  for (let bit = 0; bit < 8; bit++) index = (index >>> 1) ^ (index & 1 ? 0xedb88320 : 0)
  return index
})
function crc(bytes: Uint8Array) {
  let value = 0xffffffff
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255]
  return (value ^ 0xffffffff) >>> 0
}
function inspectXml(name: string, bytes: Uint8Array) {
  if (!/\.(xml|rels)$/.test(name)) return
  const text = decoder.decode(bytes)
  if (/\0|<!DOCTYPE|<!ENTITY/i.test(text)) invalid()
  if (/macroEnabled|vbaProject/i.test(text)) throw new ImportError('unsupported-file')
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length) invalid()
  const elements = Array.from(xml.getElementsByTagName('*'))
  if (
    name === 'xl/workbook.xml' &&
    elements.filter((node) => node.localName === 'sheet').length > 8
  )
    throw new ImportError('sheet-limit')
  if (/worksheets\//.test(name)) {
    let rows = 0,
      cells = 0
    for (const node of elements) {
      if (node.localName === 'f') throw new ImportError('formula')
      if (
        node.localName === 'row' &&
        (++rows > 204 ||
          !/^[1-9]\d*$/.test(node.getAttribute('r') ?? '') ||
          Number(node.getAttribute('r')) > 204)
      )
        throw new ImportError('sheet-limit')
      if (node.localName === 'c') {
        const address = /^([A-Z]+)([1-9]\d*)$/.exec(node.getAttribute('r') ?? '')
        const column = [...(address?.[1] ?? '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
        if (++cells > 16320 || !address || column > 80 || Number(address[2]) > 204)
          throw new ImportError('sheet-limit')
      }
    }
  }
  for (const node of elements)
    if (node.localName === 'Relationship' && node.getAttribute('TargetMode') === 'External')
      throw new ImportError('unsupported-file')
}
async function inflate(bytes: Uint8Array, method: number, size: number): Promise<Uint8Array> {
  if (method === 0) {
    if (bytes.length !== size) invalid()
    return bytes
  }
  const output = new Uint8Array(size)
  const reader = new Blob([bytes.slice().buffer])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader()
  let used = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (used + value.length > size) {
        await reader.cancel()
        throw new ImportError('file-limit')
      }
      output.set(value, used)
      used += value.length
    }
  } finally {
    reader.releaseLock()
  }
  if (used !== size) invalid()
  return output
}

// Bound decompression and validate the container before passing it to the XLSX reader.
export async function validateXlsx(buffer: ArrayBuffer) {
  const view = new DataView(buffer),
    bytes = new Uint8Array(buffer)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--)
    if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
  if (end < Math.max(0, bytes.length - 65557) || u16(end + 4) || u16(end + 6)) invalid()
  const count = u16(end + 10),
    start = u32(end + 16)
  if (!count || count !== u16(end + 8) || start + u32(end + 12) !== end) invalid()
  if (count > 128) throw new ImportError('file-limit')
  const names = new Set<string>(),
    spans: { start: number; end: number }[] = []
  let offset = start,
    total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) invalid()
    const flags = u16(offset + 8),
      method = u16(offset + 10),
      compressed = u32(offset + 20),
      size = u32(offset + 24)
    const nameLength = u16(offset + 28),
      local = u32(offset + 42)
    const next = offset + 46 + nameLength + u16(offset + 30) + u16(offset + 32)
    if (u16(offset + 34) || next > end || local + 30 > start || u32(local) !== 0x04034b50) invalid()
    if (
      flags & ~0x808 ||
      ![0, 8].includes(method) ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method
    )
      invalid()
    if (
      !(flags & 8) &&
      (u32(local + 14) !== u32(offset + 16) ||
        u32(local + 18) !== compressed ||
        u32(local + 22) !== size)
    )
      invalid()
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    const data = local + 30 + u16(local + 26) + u16(local + 28)
    if (
      !name ||
      names.has(name) ||
      /^(?:\/|[A-Z]:)|\\|\0|(?:^|\/)\.\.(?:\/|$)/i.test(name) ||
      data + compressed > start ||
      name !== decoder.decode(bytes.subarray(local + 30, local + 30 + u16(local + 26)))
    )
      invalid()
    if (/vbaProject|^xl\/externalLinks\//i.test(name)) throw new ImportError('unsupported-file')
    total += size
    if (size > 2097152 || total > 8388608) throw new ImportError('file-limit')
    names.add(name)
    spans.push({ start: local, end: data + compressed })
    const inflated = await inflate(bytes.subarray(data, data + compressed), method, size)
    if (crc(inflated) !== u32(offset + 16)) invalid()
    inspectXml(name, inflated)
    offset = next
  }
  spans.sort((a, b) => a.start - b.start)
  if (
    offset !== end ||
    spans.some((span, i) => i > 0 && span.start < spans[i - 1].end) ||
    !names.has('[Content_Types].xml') ||
    !names.has('xl/workbook.xml')
  )
    invalid()
}
