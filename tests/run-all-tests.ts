import { testOpenApiValidity } from './1-openapi-validity.test.js';
import { testFieldRenameDetection } from './2-field-rename-detection.test.js';
import { testEnumDetection } from './3-enum-detection.test.js';
import { testBackwardCompatibility } from './4-backward-compatibility.test.js';
import { testTypeGeneration } from './5-type-generation.test.js';
import { testMockDataConsistency } from './6-mock-data-consistency.test.js';
import { testTypeScriptCompilation } from './7-typescript-compiler.test.js';
import { testUnapprovedModificationRejection } from './8-unapproved-modification-rejection.test.js';
import { testInvalidApprovalHandling } from './9-invalid-approval-handling.test.js';
import { testSwitchWireProtocol } from './10-switch-wire-protocol.test.js';
import { testAntigravityAcpWorkflow } from './11-antigravity-acp-workflow.test.js';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

async function runTestSuite() {
  console.log(`======================================================================`);
  console.log(`  CONTRACTSYNC TEST SUITE — FLIP THE SWITCH 2026`);
  console.log(`======================================================================`);

  const tests = [
    { id: 1, name: 'OpenAPI Specification Validity', fn: testOpenApiValidity },
    { id: 2, name: 'Detection of Renamed Field as Breaking Change', fn: testFieldRenameDetection },
    { id: 3, name: 'Detection of Newly Introduced Enum', fn: testEnumDetection },
    { id: 4, name: 'Preservation of Deprecated Compatibility Field', fn: testBackwardCompatibility },
    { id: 5, name: 'Deterministic TypeScript Type Generation', fn: testTypeGeneration },
    { id: 6, name: 'Mock Data Consistency', fn: testMockDataConsistency },
    { id: 7, name: 'TypeScript Compilation Verification (tsc --noEmit)', fn: testTypeScriptCompilation },
    { id: 8, name: 'Rejection of Unapproved Contract Modifications', fn: testUnapprovedModificationRejection },
    { id: 9, name: 'Handling Invalid or Incomplete Approval Instructions', fn: testInvalidApprovalHandling },
    { id: 10, name: 'Switch Simulator Wire Protocol & Operations (Test Mock)', fn: testSwitchWireProtocol },
    { id: 11, name: 'Genuine Antigravity ACP Integration & Human-in-the-Loop Gate', fn: testAntigravityAcpWorkflow }
  ];

  const results: TestResult[] = [];

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      results.push({
        id: t.id,
        name: t.name,
        passed: true,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${err.message}`);
      results.push({
        id: t.id,
        name: t.name,
        passed: false,
        error: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  console.log(`\n======================================================================`);
  console.log(`  TEST RESULTS SUMMARY`);
  console.log(`======================================================================`);

  let allPassed = true;
  for (const r of results) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  [${status}] Test ${r.id.toString().padStart(2, '0')}: ${r.name.padEnd(55)} (${r.durationMs}ms)`);
    if (!r.passed) {
      allPassed = false;
      if (r.error) console.log(`         Error: ${r.error}`);
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log(`----------------------------------------------------------------------`);
  console.log(`  Total: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
  console.log(`======================================================================\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
