import { describe, expect, it } from 'vitest'
import { compileAssignment } from '../../frontend/src/features/assignment/assignment-planner'
import { checkMapping, suggestMapping } from '../../frontend/src/features/assignment/spreadsheet/mapping'
import { makeSheet, sourceRows } from '../../frontend/src/features/assignment/spreadsheet/workbook'
import { readCsv } from '../../frontend/src/features/assignment/spreadsheet/csv-reader'
import type { PlanningInput } from '../../frontend/src/features/assignment/planning-input'

const book = (available: string) => ({ sheets: [makeSheet('Jobs', [['Name', 'Required skill'], ['Équipement', 'Réparation']]), makeSheet('People', [['Name', 'Skills', 'Available', 'Job limit'], ['Mika', 'Réparation', available, '1']])] })
describe('spreadsheet mapping and source identity', () => {
  it.each(['Oui', 'Po', 'Yes', 'true', '1'])('accepts explicit true value %s and preserves accents', available => {
    const data = book(available), result = checkMapping(data, suggestMapping(data, false))
    expect(result.input?.people[0].available).toBe(true)
    expect(result.input?.jobs[0].skill).toBe('Réparation')
  })
  it.each(['Non', 'Jo', 'No', 'false', '0'])('accepts explicit false value %s', available => {
    const data = book(available)
    expect(checkMapping(data, suggestMapping(data, false)).input?.people[0].available).toBe(false)
  })
  it.each(['', 'Maybe', 'yes\n'])('never infers availability from %j', available => {
    const data = book(available)
    expect(checkMapping(data, suggestMapping(data, false)).issues).toContainEqual(expect.objectContaining({ code: 'available', row: 2, column: 2 }))
  })
  it('leaves duplicate headings unresolved and rejects reusing a source column', () => {
    const data = book('Yes'); data.sheets[0] = makeSheet('Jobs', [['Name', 'Name', 'Required skill'], ['A', 'B', 'Repair']])
    const mapping = suggestMapping(data, true)
    expect(mapping.jobs.name).toBeNull()
    mapping.jobs.name = 2
    expect(checkMapping(data, mapping).issues).toContainEqual(expect.objectContaining({ code: 'duplicate' }))
  })
  it('keeps physical row numbers when the user selects a heading below a title', () => {
    const sheet = makeSheet('Jobs', [['Daily export'], ['Name', 'Required skill'], [], ['WO-2', 'Repair']]); sheet.headingRow = 2
    expect(sourceRows(sheet)).toEqual([{ row: 4, cells: ['WO-2', 'Repair'] }])
  })
  it('preserves CSV quoted commas and newlines and rejects inconsistent/ambiguous rows', () => {
    expect(readCsv('Name,Skill\r\n"Gate, north","Repair"\r\n')).toEqual([['Name', 'Skill'], ['Gate, north', 'Repair']])
    expect(readCsv('Name,Skill\n"Gate\nNorth",Repair')).toEqual([['Name', 'Skill'], ['Gate\nNorth', 'Repair']])
    expect(() => readCsv('Name,Skill\nGate,Repair,Extra')).toThrow()
    expect(() => readCsv('Name,Skill;Capacity\nA,B;C')).toThrow()
    expect(() => readCsv('Name,Skill\n"unclosed,Repair')).toThrow()
  })
  it('does not silently drop unmapped or excess records', () => {
    const data = book('Yes'); data.sheets[0].sourceRows.push(['', '', 'Hidden record'])
    expect(checkMapping(data, suggestMapping(data, false)).issues[0].code).toBe('unmapped')
    data.sheets[0].sourceRows = [['Name', 'Required skill'], ...Array.from({ length: 200 }, (_, n) => [String(n), 'Repair'])]
    expect(checkMapping(data, suggestMapping(data, false)).issues[0].code).toBe('limit')
  })
})

// Independent resource-level enumeration: no slot transformation or compiled scoring.
function coverageOracle(input: PlanningInput, job = 0, use = input.people.map(() => 0)): number {
  if (job === input.jobs.length) return 0
  let best = coverageOracle(input, job + 1, use)
  input.people.forEach((person, index) => {
    if (!person.available || use[index] >= person.capacity || !person.skills.includes(input.jobs[job].skill)) return
    use[index]++; best = Math.max(best, 1 + coverageOracle(input, job + 1, use)); use[index]--
  })
  return best
}
it('compiled typed constraints maximize exactly the independent coverage objective across bounded cases', () => {
  for (let seed = 0; seed < 24; seed++) {
    const input: PlanningInput = {
      jobs: Array.from({ length: 1 + seed % 4 }, (_, i) => ({ name: `J${i}`, skill: ['A', 'B'][(seed + i) % 2] })),
      people: [{ name: 'One', skills: ['A'], available: seed % 3 !== 0, capacity: seed % 3 }, { name: 'Two', skills: ['A', 'B'], available: true, capacity: 1 }],
    }
    const { problem, slots } = compileAssignment(input)
    let best = -Infinity, coveredAtBest = -1
    function visit(values: number[]) {
      if (values.length < problem.variables.length) {
        for (const value of problem.variables[values.length].domain) visit([...values, value])
        return
      }
      if (new Set(values).size !== values.length) return
      const score = problem.constraints.reduce((total, rule) => total - (rule.kind === 'prefer_value' && values[rule.variable] !== rule.value ? rule.soft_weight : 0), 0)
      const covered = values.filter(value => value < slots.length).length
      if (score > best) { best = score; coveredAtBest = covered }
      else if (score === best) expect(covered).toBe(coveredAtBest)
    }
    visit([])
    expect(coveredAtBest).toBe(coverageOracle(input))
  }
})
