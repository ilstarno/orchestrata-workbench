export interface PlanningInput {
  jobs: { name: string; skill: string }[]
  people: { name: string; skills: string[]; capacity: number; available: boolean }[]
}
