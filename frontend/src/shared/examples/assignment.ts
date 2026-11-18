export const exampleJobs = ['Lift repair', 'Safety inspection', 'Preventive maintenance']
export const exampleTechnicians = new Map([
  [2, 'Sam'],
  [3, 'Noor'],
  [8, 'Alex'],
])

export const assignmentExample = {
  variables: [
    { name: 'lift_repair', domain: [8, 3] },
    { name: 'safety_inspection', domain: [8, 2] },
    { name: 'preventive_maintenance', domain: [3, 2] },
  ],
  constraints: [
    { kind: 'all_different', variables: [0, 1, 2], hard_weight: 1 },
    { kind: 'prefer_value', variable: 0, value: 8, soft_weight: 5 },
  ],
}

export const exampleDefinition = JSON.stringify(assignmentExample, null, 2)

export type Eligibility = ReadonlyArray<ReadonlyArray<number>>

export const exampleEligibility: Eligibility = assignmentExample.variables.map(
  ({ domain }) => domain,
)

export function changeEligibility(
  eligibility: Eligibility,
  job: number,
  technician: number,
  eligible: boolean,
): Eligibility {
  if (!exampleTechnicians.has(technician)) return eligibility

  return eligibility.map((domain, index) => {
    if (index !== job) return domain
    if (!eligible) return domain.filter((id) => id !== technician)
    if (domain.includes(technician)) return domain

    const selected = new Set([...domain, technician])
    const order = new Set([...exampleEligibility[index], ...exampleTechnicians.keys()])
    return [...order].filter((id) => selected.has(id))
  })
}

export function serializeEligibility(eligibility: Eligibility): string {
  return JSON.stringify(
    {
      ...assignmentExample,
      variables: assignmentExample.variables.map((variable, index) => ({
        ...variable,
        domain: eligibility[index],
      })),
    },
    null,
    2,
  )
}
