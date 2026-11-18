import type { Assignment } from './assignment'
import type { Objective } from './objective'
export interface LocalPlan {
  content_identity: string
  execution_identity: string
  input_identity: string
  objective: Objective
  source: string
  assigned: number
  total: number
  minimized_edge_sum: number
  assignments: Assignment[]
  csv: string
}
