import assert from 'assert';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export async function testOpenApiValidity() {
  console.log(`\n▶ [Test 1] Initial OpenAPI Specification Validity`);

  const specPath = path.resolve(process.cwd(), 'demo-workspace/openapi.yaml');
  assert.ok(fs.existsSync(specPath), `OpenAPI specification file must exist at ${specPath}`);

  const rawYaml = fs.readFileSync(specPath, 'utf8');
  const spec = YAML.parse(rawYaml);

  // Validate OpenAPI 3.x schema structure
  assert.ok(spec.openapi && spec.openapi.startsWith('3.'), 'Must be an OpenAPI 3.x specification');
  assert.ok(spec.info && spec.info.title, 'Specification must include info.title');
  assert.ok(spec.info.version, 'Specification must include info.version');

  // Validate GET /api/spots path
  assert.ok(spec.paths && spec.paths['/api/spots'], 'Specification must define GET /api/spots path');
  const getOp = spec.paths['/api/spots'].get;
  assert.ok(getOp, 'GET operation must be defined on /api/spots');
  assert.ok(getOp.responses && getOp.responses['200'], '200 response must be defined');

  // Validate Spot Schema in components
  assert.ok(spec.components?.schemas?.Spot, 'components.schemas.Spot must be defined');
  const spotSchema = spec.components.schemas.Spot;
  assert.strictEqual(spotSchema.type, 'object', 'Spot schema must be of type object');

  // Initial required properties
  assert.ok(spotSchema.properties.id, 'Spot must have id property');
  assert.ok(spotSchema.properties.name, 'Spot must have name property');

  console.log(`  ✓ OpenAPI 3.x structure is valid.`);
  console.log(`  ✓ GET /api/spots operation and Spot schema verified.`);
}
