import { SwitchServer } from '../switch/integration/switch-server.js';

const port = process.env.SWITCH_PORT ? parseInt(process.env.SWITCH_PORT, 10) : 8787;
const host = process.env.SWITCH_HOST || '127.0.0.1';

const server = new SwitchServer({ port, host });

server.start().then((url) => {
  console.log(`=======================================================`);
  console.log(`  Switch Room Server & Agent Bridge (v0.31.0)`);
  console.log(`  Listening at: ${url}`);
  console.log(`  Default Room: #api-contract-room`);
  console.log(`  Agent WebSocket endpoint: /agents/{agent_id}/connection/ws`);
  console.log(`  Operations endpoint:      /agents/{agent_id}/ops/{operation}`);
  console.log(`=======================================================`);
}).catch((err) => {
  console.error('Failed to start Switch Server:', err);
  process.exit(1);
});
