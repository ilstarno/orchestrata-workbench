export interface SheetSelection {
  jobs: { sheet: number | null; name: number | null; skill: number | null }
  people: {
    sheet: number | null
    name: number | null
    skills: number | null
    available: number | null
    capacity: number | null
  }
}
