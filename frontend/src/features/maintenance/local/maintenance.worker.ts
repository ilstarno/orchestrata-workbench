import wasmUrl from './assets/package-runtime.wasm?url&inline'
import packageUrl from './assets/maintenance-shift.orcpkg?url&inline'
import { createEngine } from './engine'
import { executeLocal } from './execute-local'
import type { LocalRequest } from './local-request'
function bytes(url: string) {
  if (!url.startsWith('data:') || !url.includes(';base64,')) throw new Error('asset')
  return Uint8Array.from(atob(url.split(',')[1]), (char) => char.charCodeAt(0))
}
let active = false
self.onmessage = async (event: MessageEvent<LocalRequest>) => {
  if (active) return
  active = true
  try {
    const solve = await createEngine(bytes(wasmUrl), bytes(packageUrl))
    self.postMessage({ plan: await executeLocal(event.data, solve) })
  } catch {
    self.postMessage({ error: 'failed' })
  }
}
