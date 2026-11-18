import { afterEach, expect, it, vi } from 'vitest'
import { compileAssignment, runAssignment } from '../../frontend/src/features/assignment/assignment-planner'
import type { PlanningInput } from '../../frontend/src/features/assignment/planning-input'
import { runImportedAssignment } from '../../frontend/src/features/assignment/spreadsheet/compile-assignment'

const input = (): PlanningInput => ({ jobs: [{ name: 'Gate', skill: 'Repair' }, { name: 'Door', skill: 'Repair' }], people: [{ name: 'Mika', skills: ['Repair'], available: true, capacity: 1 }] })
const response = (values = [0, 2], soft = -1) => Response.json({ solution: { values, score: { hard: 0, soft }, evaluated: 4 } })
afterEach(() => vi.unstubAllGlobals())

it('runs normalized records independently of a workbook and preserves source record association', async () => {
  const jobs = [{ id: 'job-17', name: 'Gate', skill: 'Repair' }, { id: 'job-83', name: 'Door', skill: 'Repair' }]
  const people = [{ id: 'person-45', name: 'Mika', skills: ['Repair'], available: true, capacity: 1 }]
  const fetcher = vi.fn(async (_path: string, _init: RequestInit) => response())
  vi.stubGlobal('fetch', fetcher)
  const result = await runAssignment({ jobs, people })
  expect(result.map((person, index) => ({ job: jobs[index].id, person: person === null ? null : people[person].id }))).toEqual([{ job: 'job-17', person: 'person-45' }, { job: 'job-83', person: null }])
  const request = JSON.parse(fetcher.mock.calls[0][1].body as string)
  expect(request).toEqual(compileAssignment({ jobs, people }).problem)
  expect(JSON.stringify(request)).not.toContain('person-45')
})

it.each([
  null, {}, { jobs: [], people: [] },
  { ...input(), jobs: [{ name: 'Gate', skill: '' }] },
  { ...input(), people: [{ ...input().people[0], available: 'yes' }] },
  { ...input(), people: [{ ...input().people[0], capacity: -1 }] },
  { ...input(), people: [{ ...input().people[0], capacity: 1.5 }] },
  { ...input(), people: [{ ...input().people[0], capacity: 201 }] },
  { ...input(), people: [{ ...input().people[0], skills: ['Repair\n'] }] },
  { ...input(), jobs: Array.from({ length: 200 }, () => input().jobs[0]) },
])('rejects malformed normalized records before network use: %j', async invalid => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await expect(runAssignment(invalid as PlanningInput)).rejects.toMatchObject({ kind: 'invalid-input' })
  expect(fetcher).not.toHaveBeenCalled()
})

it.each([
  [[0], -1], [[0, 0], 0], [[99, 2], -1], [[0, 2], 0], [[1, 2], -1],
])('rejects mismatched assignments or score: %j', async (values, soft) => {
  vi.stubGlobal('fetch', async () => response(values as number[], soft as number))
  await expect(runAssignment(input())).rejects.toMatchObject({ kind: 'unexpected-response' })
})

it('retains the original labels and source rows if a caller changes data while awaiting the response', async () => {
  let complete!: (value: Response) => void
  vi.stubGlobal('fetch', () => new Promise<Response>(resolve => { complete = resolve }))
  const data = input(), jobs = [4, 8], people = [9]
  const pending = runImportedAssignment(data, jobs, people)
  data.jobs[0].name = 'Changed'; data.people[0].name = 'Changed'; jobs[0] = 99; people[0] = 99
  complete(response())
  expect((await pending).rows[0]).toEqual({ job: 'Gate', person: 'Mika', sourceRow: 4, personRow: 9 })
})

it.each([[[2], [3]], [[2, 2], [3]], [[2, 3], []], [[0, 3], [4]]])('rejects incomplete or ambiguous source references', async (jobs, people) => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  await expect(runImportedAssignment(input(), jobs, people)).rejects.toMatchObject({ kind: 'invalid-input' })
  expect(fetcher).not.toHaveBeenCalled()
})

it.runIf(!!process.env.ORCHESTRATA_TEST_API)('runs normalized records through the real loopback solver without a spreadsheet adapter', async () => {
  const base = process.env.ORCHESTRATA_TEST_API!
  expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  const nativeFetch = globalThis.fetch
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => nativeFetch(base + path, init))
  const assignments = await runAssignment(input())
  expect(assignments.filter(person => person === 0)).toHaveLength(1)
  expect(assignments.filter(person => person === null)).toHaveLength(1)
  expect(await runAssignment({ jobs: input().jobs, people: [] })).toEqual([null, null])
})
