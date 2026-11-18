import { SolveError } from '../../../shared/api/solve'
import { runAssignment } from '../assignment-planner'
import type { PlanningInput } from '../planning-input'
export interface ImportedPlan { rows: { job: string; person: string | null; personRow: number | null; sourceRow: number }[] }

export async function runImportedAssignment(input: PlanningInput, sourceRows: number[], peopleRows: number[]): Promise<ImportedPlan> {
  const validRows = (rows: number[], length: number) => rows.length === length && new Set(rows).size === length && rows.every(row => Number.isSafeInteger(row) && row > 0)
  if (!validRows(sourceRows, input.jobs.length) || !validRows(peopleRows, input.people.length)) throw new SolveError('invalid-input')
  const snapshot = structuredClone({ input, sourceRows, peopleRows })
  const assignments = await runAssignment(snapshot.input)
  return { rows: assignments.map((person, index) => ({
    job: snapshot.input.jobs[index].name,
    person: person === null ? null : snapshot.input.people[person].name,
    sourceRow: snapshot.sourceRows[index],
    personRow: person === null ? null : snapshot.peopleRows[person],
  })) }
}
export function importedCsv(plan: ImportedPlan, labels: [string, string, string, string]): string {
  function cell(value: string | number) {
    const text = String(value)
    return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'
  }
  return '\uFEFF' + [labels, ...plan.rows.map(row => [row.sourceRow, row.job, row.person ?? '', row.personRow ?? ''])].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
