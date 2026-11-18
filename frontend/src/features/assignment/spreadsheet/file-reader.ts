import readXlsxFile from 'read-excel-file/browser'
import { readCsv } from './csv-reader'
import { validateXlsx } from './xlsx-safety'
import { ImportError, makeSheet, type Workbook } from './workbook'
export async function readWorkbook(file: File): Promise<Workbook> {
  if (!/\.(csv|xlsx)$/i.test(file.name)) throw new ImportError('unsupported-file')
  if (file.size > 2097152) throw new ImportError('file-limit')
  try {
    const buffer = await file.arrayBuffer()
    if (buffer.byteLength > 2097152) throw new ImportError('file-limit')
    if (/\.csv$/i.test(file.name)) return { sheets: [makeSheet(file.name.replace(/\.csv$/i, ''), readCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer)))] }
    await validateXlsx(buffer)
    const sheets = await readXlsxFile(buffer, { trim: false, parseNumber: value => value })
    return { sheets: sheets.map(({ sheet, data }) => makeSheet(sheet, data.map(row => row.map(value => value instanceof Date ? value.toISOString() : value)))) }
  } catch (error) {
    throw error instanceof ImportError ? error : new ImportError('invalid-file')
  }
}
