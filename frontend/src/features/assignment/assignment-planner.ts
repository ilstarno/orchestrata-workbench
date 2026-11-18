import type { components } from '../../shared/api/generated/orchestrata'
import { solveProblem, SolveError } from '../../shared/api/solve'
import type { PlanningInput } from './planning-input'

const text = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= 80 &&
  !/[\u0000-\u001f\u007f]/.test(value)
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Validate at the shared boundary, regardless of the input adapter. */
export function validatePlanningInput(input: unknown): asserts input is PlanningInput {
  if (
    !record(input) ||
    !Array.isArray(input.jobs) ||
    !Array.isArray(input.people) ||
    input.jobs.length < 1 ||
    input.jobs.length + input.people.length > 200 ||
    !input.jobs.every((job) => record(job) && text(job.name) && text(job.skill)) ||
    !input.people.every(
      (person) =>
        record(person) &&
        text(person.name) &&
        Array.isArray(person.skills) &&
        person.skills.length <= 20 &&
        person.skills.every(text) &&
        typeof person.available === 'boolean' &&
        Number.isInteger(person.capacity) &&
        Number(person.capacity) >= 0 &&
        Number(person.capacity) <= 200,
    )
  ) {
    throw new SolveError('invalid-input')
  }
}

const skillKey = (value: string) => value.normalize('NFC').trim().toLowerCase()
export function compileAssignment(input: PlanningInput) {
  validatePlanningInput(input)
  const slots = input.people.flatMap((person, index) =>
    Array.from(
      { length: person.available ? Math.min(person.capacity, input.jobs.length) : 0 },
      () => index,
    ),
  )
  const variables = input.jobs.map((job, index) => ({
    name: `job_${index + 1}`,
    domain: [
      ...slots.flatMap((person, slot) =>
        input.people[person].skills.some((skill) => skillKey(skill) === skillKey(job.skill))
          ? [slot]
          : [],
      ),
      slots.length + index,
    ],
  }))
  const constraints: components['schemas']['Constraint'][] = [
    { kind: 'all_different', variables: variables.map((_, index) => index), hard_weight: 1 },
    // Each covered job improves the objective by exactly one, independent of its number of eligible slots.
    ...variables.flatMap((variable, index) =>
      variable.domain.slice(0, -1).map((value) => ({
        kind: 'prefer_value' as const,
        variable: index,
        value,
        soft_weight: 1,
      })),
    ),
  ]
  return { problem: { variables, constraints } satisfies components['schemas']['Problem'], slots }
}
/** Run normalized assignment data through the existing authoritative solve endpoint. */
export async function runAssignment(input: PlanningInput): Promise<(number | null)[]> {
  const { problem, slots } = compileAssignment(input)
  const result = await solveProblem(JSON.stringify(problem))
  if (result.kind !== 'solved' || result.assignment.values.length !== problem.variables.length)
    throw new SolveError('unexpected-response')
  const seen = new Set<number>()
  const assignments = result.assignment.values.map((value, index) => {
    if (!problem.variables[index].domain.includes(value) || seen.has(value))
      throw new SolveError('unexpected-response')
    seen.add(value)
    return value < slots.length ? slots[value] : null
  })
  const expectedScore = problem.constraints.reduce(
    (score, constraint) =>
      score -
      (constraint.kind === 'prefer_value' &&
      result.assignment.values[constraint.variable] !== constraint.value
        ? constraint.soft_weight
        : 0),
    0,
  )
  if (result.assignment.score.soft !== expectedScore) throw new SolveError('unexpected-response')
  return assignments
}
