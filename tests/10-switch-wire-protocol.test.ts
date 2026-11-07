import assert from 'assert';
import { SwitchServer } from '../switch/integration/switch-server.js';
import { SwitchClient } from '../switch/integration/switch-client.js';
import { SwitchMessagePayload } from '../switch/integration/types.js';

export async function testSwitchWireProtocol() {
  console.log(`\n▶ [Test 10] Switch Protocol WebSocket & Operations Verification`);

  const port = 8797;
  const server = new SwitchServer({ port });
  const serverUrl = await server.start();

  // Test 1: Agent Registration
  const clientA = new SwitchClient({
    serverUrl,
    agentName: 'test-agent-a',
    description: 'First test agent',
    roomId: 'api-contract-room'
  });

  const clientB = new SwitchClient({
    serverUrl,
    agentName: 'test-agent-b',
    description: 'Second test agent',
    roomId: 'api-contract-room'
  });

  await clientA.connect();
  await clientB.connect();

  assert.ok(clientA.apiKey, 'Client A must receive api_key upon registration');
  assert.ok(clientB.apiKey, 'Client B must receive api_key upon registration');

  // Test 2: Message Broadcast & Sequencing
  const receivedMessages: SwitchMessagePayload[] = [];
  clientB.on('message', (payload: SwitchMessagePayload) => {
    receivedMessages.push(payload);
  });

  const sentMsg = await clientA.postMessage('Hello from Agent A via Switch wire protocol!');
  assert.strictEqual(sentMsg.seq, 1, 'First message in room must have seq 1');
  assert.strictEqual(sentMsg.sender, '@test-agent-a:switch-local');

  // Wait for WebSocket delivery
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.strictEqual(receivedMessages.length, 1, 'Client B must receive broadcasted message');
  assert.strictEqual(receivedMessages[0].body, 'Hello from Agent A via Switch wire protocol!');

  // Test 3: Read Context Operation
  const context = await clientB.readContext(10);
  assert.ok(Array.isArray(context), 'Read context must return array');
  assert.strictEqual(context.length, 1, 'Read context must contain 1 message');
  assert.strictEqual(context[0].seq, 1);

  // Test 4: Targeted Message Handoff
  await clientA.sendTargetedMessage('test-agent-b', 'HANDOFF: Target instruction');
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.strictEqual(receivedMessages.length, 2, 'Client B must receive targeted message');
  assert.strictEqual(receivedMessages[1].target_agent_id, 'test-agent-b');
  assert.strictEqual(receivedMessages[1].seq, 2, 'Monotonic seq must increment to 2');

  clientA.disconnect();
  clientB.disconnect();
  await server.stop();

  console.log(`  ✓ Switch registration and API key provisioning verified.`);
  console.log(`  ✓ WebSocket event frames and monotonic seq counter verified.`);
  console.log(`  ✓ Targeted messaging and read_context operations verified.`);
}
