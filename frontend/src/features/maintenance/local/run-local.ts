import { validateRecords } from '../input-model'
import type { LocalRequest } from './local-request'
import type { LocalPlan } from './local-plan'
import type { WorkerPort } from './worker-port'
import { DEADLINE_MS } from './pins'
import { decodePlan } from './decode-plan'
import { digest } from './digest'
export function runLocal(
  request: LocalRequest,
  signal: AbortSignal,
  create: () => WorkerPort = () =>
    new Worker(new URL('./maintenance.worker.ts', import.meta.url), { type: 'module' }),
): Promise<LocalPlan> {
  return new Promise((resolve, reject) => {
    if (
      signal.aborted ||
      validateRecords(request.records).length ||
      !['cost', 'delay'].includes(request.objective)
    ) {
      reject(new Error('input'))
      return
    }
    let worker: WorkerPort | undefined,
      settled = false
    const finish = (plan?: LocalPlan, error = 'failed') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      worker?.terminate()
      if (plan) resolve(plan)
      else reject(new Error(error))
    }
    const abort = () => finish(undefined, 'cancelled')
    const timer = setTimeout(() => finish(undefined, 'timeout'), DEADLINE_MS)
    signal.addEventListener('abort', abort, { once: true })
    try {
      worker = create()
      worker.onerror = () => finish()
      worker.onmessageerror = () => finish()
      worker.onmessage = async (event) => {
        try {
          const plan = event.data?.plan
          const identity = await digest(new TextEncoder().encode(JSON.stringify(request.records)))
          if (!plan || plan.input_identity !== identity || plan.objective !== request.objective)
            throw new Error('result')
          const checked = decodePlan(
            JSON.stringify({
              content_identity: plan.content_identity,
              execution_identity: plan.execution_identity,
              solution: {
                assigned: plan.assigned,
                minimized_edge_sum: plan.minimized_edge_sum,
                assignments: plan.assignments,
              },
            }),
            request,
            identity,
          )
          finish(checked)
        } catch {
          finish()
        }
      }
      worker.postMessage(structuredClone(request))
    } catch {
      finish()
    }
  })
}
