import type { components, paths } from './generated/orchestrata'

const solvePath = '/api/v1/solve' satisfies keyof paths

export type Assignment = components['schemas']['Solution']

export type SolveResult =
  | { kind: 'solved'; assignment: Assignment }
  | { kind: 'exact-json'; json: string }
  | { kind: 'infeasible' }

export type SolveFailure =
  | 'access-denied'
  | 'invalid-input'
  | 'search-limit'
  | 'ambiguous-request'
  | 'busy'
  | 'offline'
  | 'execution'
  | 'unexpected-response'

const ERROR_CODE_HEADER = 'x-orchestrata-error-code'

const indexedFailures = {
  invalid_request_body: 'invalid-input',
  invalid_problem: 'invalid-input',
  search_limit_exceeded: 'search-limit',
  solve_execution_failed: 'execution',
  solver_busy: 'busy',
  not_found: 'unexpected-response',
  method_not_allowed: 'unexpected-response',
  request_rejected: 'unexpected-response',
  internal_error: 'execution',
} as const satisfies Record<string, SolveFailure>

export type SolveErrorCode = keyof typeof indexedFailures

export class SolveError extends Error {
  constructor(
    readonly kind: SolveFailure,
    readonly code?: SolveErrorCode,
  ) {
    super(kind)
    this.name = 'SolveError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isAssignment(value: unknown): value is Assignment {
  return (
    isRecord(value) &&
    Array.isArray(value.values) &&
    value.values.every(isInteger) &&
    isRecord(value.score) &&
    value.score.hard === 0 &&
    isInteger(value.score.soft) &&
    value.score.soft <= 0 &&
    isInteger(value.evaluated) &&
    value.evaluated > 0
  )
}

export function parseSolveResult(raw: string): SolveResult {
  let response: unknown
  try {
    response = JSON.parse(raw)
  } catch {
    throw new SolveError('unexpected-response')
  }

  if (!isRecord(response)) throw new SolveError('unexpected-response')
  const { solution } = response
  if (solution === null) return { kind: 'infeasible' }
  if (!isAssignment(solution)) throw new SolveError('unexpected-response')

  // The backend permits 64-bit integers. Preserve the wire text rather than display rounded numbers.
  const safeIntegers = [...solution.values, solution.score.soft, solution.evaluated].every(
    Number.isSafeInteger,
  )
  if (!safeIntegers) return { kind: 'exact-json', json: raw }

  return { kind: 'solved', assignment: solution }
}

function isSolveErrorCode(value: string): value is SolveErrorCode {
  return Object.hasOwn(indexedFailures, value)
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    throw new SolveError('offline')
  }
}

async function classifyLegacyFailure(response: Response): Promise<SolveFailure> {
  const { status } = response
  if (status === 429 || status === 503) return 'busy'
  if (status >= 500) return 'execution'
  if (status === 400 || status === 413 || status === 415) return 'invalid-input'
  if (status !== 422) return 'unexpected-response'
  const detail = (await readBody(response)).trim()
  if (detail === 'Search space exceeds the evaluation limit') return 'search-limit'
  if (detail === 'Invalid problem') return 'invalid-input'
  return 'ambiguous-request'
}

export async function decodeSolveFailure(response: Response): Promise<SolveError> {
  if (response.status === 401 || response.status === 403) return new SolveError('access-denied')
  const code = response.headers.get(ERROR_CODE_HEADER)
  if (code === null) return new SolveError(await classifyLegacyFailure(response))
  if (isSolveErrorCode(code)) return new SolveError(indexedFailures[code], code)

  return new SolveError('unexpected-response')
}

export async function solveProblem(body: string): Promise<SolveResult> {
  try {
    JSON.parse(body)
  } catch {
    throw new SolveError('invalid-input')
  }

  let response: Response
  try {
    response = await fetch(solvePath, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch {
    throw new SolveError('offline')
  }

  if (!response.ok) throw await decodeSolveFailure(response)
  if (response.status !== 200) throw new SolveError('unexpected-response')
  return parseSolveResult(await readBody(response))
}
