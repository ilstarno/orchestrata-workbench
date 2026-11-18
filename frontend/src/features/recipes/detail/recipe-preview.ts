import { recipeFieldKindValues, type components } from '../../../shared/api/generated/orchestrata'

export type RecipePreview = Readonly<{
  metadata: components['schemas']['RecipeMetadataResponse']
  exactExampleJson: string
}>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isField(value: unknown): value is RecipePreview['metadata']['inputs'][number] {
  return isObject(value)
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && typeof value.required === 'boolean'
    && recipeFieldKindValues.some(kind => kind === value.kind)
}

export function parseRecipePreview(id: string, meta: unknown, exactExampleJson: string): RecipePreview {
  if (!isObject(meta) || meta.id !== id || typeof meta.title !== 'string' || typeof meta.scenario !== 'string'
    || !Array.isArray(meta.inputs) || !meta.inputs.every(isField)
    || !Array.isArray(meta.outputs) || !meta.outputs.every(isField)) {
    throw new Error('Invalid recipe metadata')
  }
  const example: unknown = JSON.parse(exactExampleJson)
  if (!isObject(example)
    || !Array.isArray(example.variables)
    || !example.variables.every(variable => isObject(variable) && typeof variable.name === 'string'
      && Array.isArray(variable.domain)
      && variable.domain.every(value => typeof value === 'number' && Number.isInteger(value)))
    || !Array.isArray(example.constraints)
    || !example.constraints.every(constraint => isObject(constraint) && typeof constraint.kind === 'string')) {
    throw new Error('Invalid recipe example')
  }
  return {
    metadata: { id, title: meta.title, scenario: meta.scenario, inputs: meta.inputs, outputs: meta.outputs },
    exactExampleJson,
  }
}
