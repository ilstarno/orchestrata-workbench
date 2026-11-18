import type { components } from '../../../shared/api/generated/orchestrata'
import { solveProblem, SolveError } from '../../../shared/api/solve'
import type { PlanningInput } from './planning-input'
export interface ImportedPlan { rows: { job: string; person: string | null; personRow: number | null; sourceRow: number }[] }
const skillKey = (value: string) => value.normalize('NFC').trim().toLowerCase()
export function compileAssignment(input: PlanningInput) {
  const slots = input.people.flatMap((person, index) => Array.from({ length: person.available ? Math.min(person.capacity, input.jobs.length) : 0 }, () => index))
  const variables = input.jobs.map((job, index) => ({
    name: `job_${index + 1}`,
    domain: [...slots.flatMap((person, slot) => input.people[person].skills.some(skill => skillKey(skill) === skillKey(job.skill)) ? [slot] : []), slots.length + index],
  }))
  const constraints: components['schemas']['Constraint'][] = [
    { kind: 'all_different', variables: variables.map((_, index) => index), hard_weight: 1 },
    // Each covered job improves the objective by exactly one, independent of its number of eligible slots.
    ...variables.flatMap((variable, index) => variable.domain.slice(0, -1).map(value => ({ kind: 'prefer_value' as const, variable: index, value, soft_weight: 1 }))),
  ]
  return { problem: { variables, constraints } satisfies components['schemas']['Problem'], slots }
}
export async function runImportedAssignment(input: PlanningInput, sourceRows: number[], peopleRows: number[]): Promise<ImportedPlan> {
  const { problem, slots } = compileAssignment(input)
  const result = await solveProblem(JSON.stringify(problem))
  if (result.kind !== 'solved' || result.assignment.values.length !== input.jobs.length) throw new SolveError('unexpected-response')
  const seen = new Set<number>()
  const rows = result.assignment.values.map((value, index) => {
    if (!problem.variables[index].domain.includes(value) || seen.has(value)) throw new SolveError('unexpected-response')
    seen.add(value)
    return { job: input.jobs[index].name, person: value < slots.length ? input.people[slots[value]].name : null, sourceRow: sourceRows[index], personRow: value < slots.length ? peopleRows[slots[value]] : null }
  })
  return { rows }
}
export function importedCsv(plan: ImportedPlan, labels: [string, string, string, string]): string {
  function cell(value: string | number) {
    const text = String(value)
    return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'
  }
  return '\uFEFF' + [labels, ...plan.rows.map(row => [row.sourceRow, row.job, row.person ?? '', row.personRow ?? ''])].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
