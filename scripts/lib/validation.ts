import Ajv2020, { type AnySchema, type ErrorObject } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

const getValueAtPointer = (data: unknown, pointer: string): unknown => {
  if (!pointer || pointer === '/') {
    return data
  }

  const parts = pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))

  let current: unknown = data
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
      continue
    }

    return undefined
  }

  return current
}

export const formatAjvError = (error: ErrorObject, data: unknown): string => {
  const path = error.instancePath || '/'
  const value = getValueAtPointer(data, error.instancePath)
  const serialized = JSON.stringify(value)

  return `${path}: ${error.message ?? 'validation error'} (value=${serialized})`
}

export const validatePokemonDataset = (
  schema: unknown,
  data: unknown,
): string[] => {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)

  const validate = ajv.compile(schema as AnySchema)
  const valid = validate(data)

  if (valid) {
    return []
  }

  return (validate.errors ?? []).map((error) => formatAjvError(error, data))
}
