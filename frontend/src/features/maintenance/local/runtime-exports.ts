export interface RuntimeExports {
  memory: WebAssembly.Memory
  package_prepare(archive: number, records: number, selection: number): number
  package_input_ptr(): number
  package_solve(): number
  package_output_len(): number
  package_output_ptr(): number
  package_reset(): void
}
