import { describe, expect, it } from 'vitest'
import { planCsv } from '../../frontend/src/features/assignment/plan-export'

describe('plan CSV snapshot', () => {
  const result = { kind: 'solved' as const, assignment: { values: [8, 2, 3], score: { hard: 0, soft: 0 }, evaluated: 8 } }
  it('keeps stable decision order and sample names only when that input was used', () => {
    expect(planCsv(result, true, ['Job', 'Person'])).toBe('\uFEFF"Job","Person"\r\n"Lift repair","Alex"\r\n"Safety inspection","Sam"\r\n"Preventive maintenance","Noor"\r\n')
    expect(planCsv(result, false, ['Decision', 'Value'])).toContain('"1","8"')
  })
  it('escapes quotes, preserves accents and neutralizes formula-like text', () => {
    expect(planCsv(result, true, ['=1+2', 'Équipe "A"'])).toContain('"\'=1+2","Équipe ""A"""')
  })
  it('does not turn infeasibility or unsafe integer wire text into a downloadable plan', () => {
    expect(planCsv({ kind: 'infeasible' }, false, ['A', 'B'])).toBeUndefined()
    expect(planCsv({ kind: 'exact-json', json: '{}' }, false, ['A', 'B'])).toBeUndefined()
  })
})
