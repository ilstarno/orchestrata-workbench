import { initSync } from './assets/package_runtime.js'
import { digest } from './digest'
import { WASM_SHA256, PACKAGE_SHA256 } from './pins'
import type { Objective } from './objective'
export async function createEngine(wasm: Uint8Array, archive: Uint8Array) {
  if ((await digest(wasm)) !== WASM_SHA256 || (await digest(archive)) !== PACKAGE_SHA256)
    throw new Error('asset')
  const module = await WebAssembly.compile(new Uint8Array(wasm).buffer)
  const imports = WebAssembly.Module.imports(module)
  if (
    imports.length !== 1 ||
    imports[0].module !== './package_runtime_bg.js' ||
    imports[0].name !== '__wbindgen_init_externref_table' ||
    imports[0].kind !== 'function'
  )
    throw new Error('asset')
  const engine = initSync({ module })
  return (records: string, objective: Objective): string => {
    const input = new TextEncoder().encode(records),
      selected = new TextEncoder().encode(objective)
    if (input.length > 524288 || !['cost', 'delay'].includes(objective)) throw new Error('input')
    if (engine.package_prepare(archive.length, input.length, selected.length) !== 0)
      throw new Error('input')
    try {
      const target = new Uint8Array(
        engine.memory.buffer,
        engine.package_input_ptr() >>> 0,
        archive.length + input.length + selected.length,
      )
      target.set(archive)
      target.set(input, archive.length)
      target.set(selected, archive.length + input.length)
      const status = engine.package_solve(),
        length = engine.package_output_len() >>> 0
      if (length > 262144 || status !== 0) throw new Error('solve')
      return new TextDecoder('utf-8', { fatal: true }).decode(
        new Uint8Array(engine.memory.buffer, engine.package_output_ptr() >>> 0, length),
      )
    } finally {
      engine.package_reset()
    }
  }
}
