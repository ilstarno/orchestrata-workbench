import type { SolveResult } from '../../shared/api/solve'
import { exampleJobs, exampleTechnicians } from '../../shared/examples/assignment'

function csvCell(value: string | number): string {
  // Text labels can later come from imported spreadsheets. Keep them literal in spreadsheet apps.
  const text = String(value)
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function planCsv(result: SolveResult, example: boolean, headings: readonly [string, string]): string | undefined {
  if (result.kind !== 'solved') return undefined
  const rows: (string | number)[][] = [Array.from(headings)]
  result.assignment.values.forEach((value, index) => rows.push([
    example ? exampleJobs[index] ?? index + 1 : index + 1,
    example ? exampleTechnicians.get(value) ?? value : value,
  ]))
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
