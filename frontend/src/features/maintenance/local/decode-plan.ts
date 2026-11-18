import { CONTENT_IDENTITY, EXECUTION_IDENTITY } from './pins'
import type { LocalPlan } from './local-plan'
import type { LocalRequest } from './local-request'
import type { Assignment } from './assignment'
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const cell = (value: string) =>
  '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"'
export function decodePlan(text: string, request: LocalRequest, inputIdentity: string): LocalPlan {
  const result: unknown = JSON.parse(text)
  if (
    !object(result) ||
    result.content_identity !== CONTENT_IDENTITY ||
    result.execution_identity !== EXECUTION_IDENTITY[request.objective] ||
    !object(result.solution)
  )
    throw new Error('result')
  const solution = result.solution,
    assignments: Assignment[] = []
  if (
    !Array.isArray(solution.assignments) ||
    solution.assignments.length !== request.records.work_orders.length
  )
    throw new Error('result')
  const seen = new Set<string>(),
    counts = new Map<string, number>()
  let assigned = 0,
    sum = 0
  const metric = request.objective === 'cost' ? 'cost_cents' : 'delay_minutes'
  const csv = ['work_order_id,technician_id,status,' + metric + ',entrypoint,input_identity']
  for (const row of solution.assignments) {
    if (
      !object(row) ||
      typeof row.item_id !== 'string' ||
      seen.has(row.item_id) ||
      !request.records.work_orders.some((item) => item.id === row.item_id) ||
      !(row.resource_id === null || typeof row.resource_id === 'string')
    )
      throw new Error('result')
    seen.add(row.item_id)
    let value = ''
    if (row.resource_id !== null) {
      const tech = request.records.technicians.find((item) => item.id === row.resource_id)
      const edge = request.records.eligibility.find(
        (item) => item.work_order_id === row.item_id && item.technician_id === row.resource_id,
      )
      const count = (counts.get(row.resource_id) ?? 0) + 1
      if (
        !tech ||
        !tech.available ||
        !edge ||
        count > Math.min(3, Number(tech.capacity_slots)) ||
        !Number.isSafeInteger(edge[metric])
      )
        throw new Error('result')
      counts.set(row.resource_id, count)
      assigned++
      sum += Number(edge[metric])
      value = String(edge[metric])
    }
    assignments.push({ item_id: row.item_id, resource_id: row.resource_id })
    csv.push(
      [
        row.item_id,
        row.resource_id ?? '',
        row.resource_id === null ? 'unassigned' : 'assigned',
        value,
        request.objective,
        inputIdentity,
      ]
        .map(cell)
        .join(','),
    )
  }
  if (solution.assigned !== assigned || solution.minimized_edge_sum !== sum)
    throw new Error('result')
  return {
    content_identity: CONTENT_IDENTITY,
    execution_identity: EXECUTION_IDENTITY[request.objective],
    input_identity: inputIdentity,
    source: request.source,
    objective: request.objective,
    assigned,
    total: assignments.length,
    minimized_edge_sum: sum,
    assignments,
    csv: csv.join('\r\n') + '\r\n',
  }
}
