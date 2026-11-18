import type { LocalRequest } from './local-request'
export interface WorkerPort {
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
  postMessage(request: LocalRequest): void
  terminate(): void
}
