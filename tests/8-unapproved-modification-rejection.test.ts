import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { SpecArchitectAgent } from '../agents/spec-architect/agent.js';
import { SwitchServer } from '../switch/integration/switch-server.js';

export async function testUnapprovedModificationRejection() {
  console.log(`\n▶ [Test 8] Rejection of Unapproved Contract Modifications`);

  const port = 8798;
  const server = new SwitchServer({ port });
  await server.start();

  const specPath = path.resolve(process.cwd(), 'demo-workspace/openapi.yaml');
  const originalSpecContent = fs.readFileSync(specPath, 'utf8');

  const agent = new SpecArchitectAgent({
    serverUrl: `http://127.0.0.1:${port}`,
    specPath
  });
  await agent.start();

  // Send modification request
  await agent.handleIncomingMessage({
    seq: 1,
    message_id: 'm1',
    room_id: 'api-contract-room',
    sender: '@developer:switch-local',
    sender_name: 'Developer',
    body: 'Update GET /api/spots. Rename spot_status to availability_state and add a role field with the values admin, user and guest.',
    addressed: true,
    timestamp: Date.now()
  });

  // Verify agent state is AWAITING_APPROVAL
  assert.strictEqual(agent.state, 'AWAITING_APPROVAL', 'SpecArchitect must enter AWAITING_APPROVAL state');

  // Verify spec file has NOT been modified yet
  const specAfterRequest = fs.readFileSync(specPath, 'utf8');
  assert.strictEqual(specAfterRequest, originalSpecContent, 'openapi.yaml MUST NOT be modified before approval');

  // Send an ordinary conversational message (not an approval)
  await agent.handleIncomingMessage({
    seq: 2,
    message_id: 'm2',
    room_id: 'api-contract-room',
    sender: '@developer:switch-local',
    sender_name: 'Developer',
    body: 'What do you think about deploying this next week?',
    addressed: true,
    timestamp: Date.now()
  });

  // Verify state remains AWAITING_APPROVAL and spec file is STILL unmodified
  assert.strictEqual(agent.state, 'AWAITING_APPROVAL', 'SpecArchitect must still be AWAITING_APPROVAL');
  const specAfterChat = fs.readFileSync(specPath, 'utf8');
  assert.strictEqual(specAfterChat, originalSpecContent, 'openapi.yaml MUST remain unmodified after ordinary messages');

  await agent.stop();
  await server.stop();

  console.log(`  ✓ Unapproved contract modification strictly rejected.`);
  console.log(`  ✓ Human approval gate safely enforced.`);
}
