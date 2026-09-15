import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { load } from 'js-yaml';

const SPEC_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'spec', 'openapi.yaml');
const SCHEMA_ROOT_ID = 'openapi.yaml';

const openApiDocument = load(readFileSync(SPEC_PATH, 'utf8')) as Record<string, unknown>;

// The spec uses OpenAPI-only annotation keywords (`example`, etc.) that plain JSON
// Schema doesn't know about, so strict mode is off; every schema under test is still
// checked for real structural violations (required/type/enum/additionalProperties/...).
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(openApiDocument, SCHEMA_ROOT_ID);

const validatorCache = new Map<string, ValidateFunction>();

function getValidator(schemaName: string): ValidateFunction {
  const cached = validatorCache.get(schemaName);
  if (cached) return cached;

  const ref = `${SCHEMA_ROOT_ID}#/components/schemas/${schemaName}`;
  const validate = ajv.getSchema(ref);
  if (!validate) {
    throw new Error(`No such schema "${schemaName}" in ${SPEC_PATH} (looked for ${ref})`);
  }
  validatorCache.set(schemaName, validate);
  return validate;
}

export interface SchemaCheck {
  valid: boolean;
  errors: string;
}

/** Validates `data` against `components.schemas.<schemaName>` from spec/openapi.yaml. */
export function checkSchema(schemaName: string, data: unknown): SchemaCheck {
  const validate = getValidator(schemaName);
  const valid = validate(data);
  return {
    valid: Boolean(valid),
    errors: valid ? '' : ajv.errorsText(validate.errors, { separator: '\n', dataVar: 'response' }),
  };
}
