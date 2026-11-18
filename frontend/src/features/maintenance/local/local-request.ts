import type { Records } from '../input-model'
import type { Objective } from './objective'
export interface LocalRequest {
  records: Records
  objective: Objective
  source: string
}
