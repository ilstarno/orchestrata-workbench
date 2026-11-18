import { validateRecords } from '../input-model'
import type { LocalRequest } from './local-request'
import { decodePlan } from './decode-plan'
import { digest } from './digest'
export async function executeLocal(
  request: LocalRequest,
  solve: (records: string, objective: LocalRequest['objective']) => string,
) {
  if (
    !request ||
    !['cost', 'delay'].includes(request.objective) ||
    typeof request.source !== 'string' ||
    request.source.length > 4096 ||
    validateRecords(request.records).length
  )
    throw new Error('input')
  const records = JSON.stringify(request.records)
  const bytes = new TextEncoder().encode(records)
  if (bytes.length > 524288) throw new Error('input')
  const identity = await digest(bytes)
  return decodePlan(solve(records, request.objective), request, identity)
}
