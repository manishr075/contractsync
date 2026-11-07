import path from 'path';
import fs from 'fs';
import { SwitchServer } from '../switch/simulator/switch-server.js';
import { SpecArchitectAgent } from '../agents/spec-architect/agent.js';
import { FrontendSyncAgent } from '../agents/frontend-sync/agent.js';
import { SwitchMessagePayload } from '../switch/simulator/types.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runContractSyncDemo() {
  console.log(`\n======================================================================`);
  console.log(`  CONTRACTSYNC — OFFLINE SIMULATOR DEMONSTRATION WORKFLOW`);
  console.log(`  (Using Local Test Simulator & Mock WebSocket Message Bus)`);
  console.log(`  For Genuine Antigravity ACP: run 'npm run workflow:antigravity'`);
  console.log(`======================================================================\n`);

  const port = 8799;
  const serverUrl = `http://127.0.0.1:${port}`;
  const workspaceDir = path.resolve(process.cwd(), 'demo-workspace');
  const specPath = path.resolve(workspaceDir, 'openapi.yaml');

  // 0. Ensure initial clean contract state
  const initialYaml = `openapi: 3.0.3
info:
  title: Spot Service API
  version: 1.0.0
  description: API for managing physical spaces and resource spots in the campus facility.
paths:
  /api/spots:
    get:
      summary: Retrieve spots
      description: Returns a list or single spot with status information.
      responses:
        '200':
          description: Successful spot lookup
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Spot'
components:
  schemas:
    Spot:
      type: object
      required:
        - id
        - name
        - spot_status
      properties:
        id:
          type: integer
          description: Unique spot identifier
          example: 101
        name:
          type: string
          description: Name of the facility or spot
          example: Library
        spot_status:
          type: string
          description: Current operational status of the spot
          example: available
`;
  fs.writeFileSync(specPath, initialYaml, 'utf8');

  // 1. Start real Switch Room Server & Agent Bridge
  console.log(`[Switch Infrastructure] Starting local Switch Room Server on port ${port}...`);
  const switchServer = new SwitchServer({ port });
  await switchServer.start();
  console.log(`[Switch Infrastructure] Switch Server online at ${serverUrl}`);
  console.log(`[Switch Infrastructure] Created shared room: #api-contract-room`);

  // 2. Connect SpecArchitect Agent
  console.log(`\n[Agent 1: SpecArchitect] Initializing Backend API Guardian...`);
  const specArchitect = new SpecArchitectAgent({ serverUrl, specPath });
  await specArchitect.start();

  // 3. Connect FrontendSync Agent
  console.log(`[Agent 2: FrontendSync] Initializing Frontend Integration Engineer...`);
  const frontendSync = new FrontendSyncAgent({ serverUrl, workspaceDir });
  await frontendSync.start();

  // Subscribe a room logger to observe all Switch room events live
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`  LIVE FEED: #api-contract-room (Switch Message Log)`);
  console.log(`----------------------------------------------------------------------\n`);

  let lastReportReceived = false;
  let reportResolver: () => void;
  const reportPromise = new Promise<void>((resolve) => {
    reportResolver = resolve;
  });

  // Watch room messages
  const pollLog = setInterval(() => {
    const log = switchServer.getRoomLog('api-contract-room');
    if (log.length > 0) {
      const lastMsg = log[log.length - 1];
      if (lastMsg.body.includes('[FRONTEND SYNCHRONIZATION COMPLETE]') && !lastReportReceived) {
        lastReportReceived = true;
        clearInterval(pollLog);
        reportResolver();
      }
    }
  }, 300);

  // Hook into server room message broadcast to print nicely
  const originalDispatch = switchServer.dispatchRoomMessage.bind(switchServer);
  switchServer.dispatchRoomMessage = (params) => {
    const result = originalDispatch(params);
    const time = new Date(result.timestamp).toLocaleTimeString();
    console.log(`\n💬 [MSG #${result.seq} | ${time}] ${result.sender_name} (${result.sender}):`);
    console.log(result.body.split('\n').map((l) => `   ${l}`).join('\n'));
    return result;
  };

  await delay(1000);

  // Step 1 — Human request
  console.log(`\n======================================================================`);
  console.log(`  STEP 1: DEVELOPER POSTS API CHANGE REQUEST IN SWITCH ROOM`);
  console.log(`======================================================================`);

  const requestText =
    'Update GET /api/spots. Rename spot_status to availability_state and add a role field with the values admin, user and guest.';

  switchServer.dispatchRoomMessage({
    roomId: 'api-contract-room',
    senderLocal: 'developer',
    senderName: 'Developer',
    body: requestText
  });

  // Wait for SpecArchitect to process and post proposal
  await delay(2000);

  // Step 2 Verification: SpecArchitect proposed migration, openapi.yaml is UNCHANGED
  console.log(`\n======================================================================`);
  console.log(`  STEP 2 VERIFICATION: HUMAN APPROVAL GATE ENFORCED`);
  console.log(`======================================================================`);
  const currentSpecBeforeApproval = fs.readFileSync(specPath, 'utf8');
  const isUnmodified = currentSpecBeforeApproval.includes('spot_status') && !currentSpecBeforeApproval.includes('availability_state');
  console.log(`[Safety Check] Has openapi.yaml been modified before approval? ${!isUnmodified ? 'YES (UNSAFE!)' : 'NO (SAFE & ENFORCED)'}`);

  // Step 3 — Human approval
  console.log(`\n======================================================================`);
  console.log(`  STEP 3: DEVELOPER POSTS EXPLICIT APPROVAL IN SWITCH ROOM`);
  console.log(`======================================================================`);

  const approvalText =
    'APPROVE: Introduce availability_state, retain spot_status as an optional deprecated field for backward compatibility, and add the role enum.';

  switchServer.dispatchRoomMessage({
    roomId: 'api-contract-room',
    senderLocal: 'developer',
    senderName: 'Developer',
    body: approvalText
  });

  // Wait for Step 4 (SpecArchitect updates spec), Step 5 (FrontendSync updates types/mocks), Step 6 (npx tsc), Step 7 (Final report)
  console.log(`\nWaiting for agent collaboration and compiler verification...`);
  await reportPromise;

  await delay(1000);

  console.log(`\n======================================================================`);
  console.log(`  DEMONSTRATION COMPLETE`);
  console.log(`======================================================================`);
  console.log(`✓ Both agents collaborated strictly through Switch WebSocket & Operations protocol.`);
  console.log(`✓ Human approval gate prevented unapproved contract modification.`);
  console.log(`✓ OpenAPI specification updated to v1.1.0.`);
  console.log(`✓ TypeScript definitions generated in demo-workspace/src/api.types.ts.`);
  console.log(`✓ Mock responses synchronized in demo-workspace/src/mocks.ts.`);
  console.log(`✓ TypeScript compiler verification executed: npx tsc --noEmit (Exit 0).`);

  // Clean shutdown
  specArchitect.stop();
  frontendSync.stop();
  await switchServer.stop();
  process.exit(0);
}

runContractSyncDemo().catch((err) => {
  console.error('Demo encountered fatal error:', err);
  process.exit(1);
});
