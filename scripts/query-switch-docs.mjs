// Query the official Switch AI documentation MCP server
async function callMCP(method, params) {
  const res = await fetch('https://docs.switchagents.ai/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    })
  });
  const text = await res.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      return JSON.parse(line.slice(6));
    }
  }
  return JSON.parse(text);
}

async function main() {
  const query = process.argv[2] || 'tree / -L 3';
  const isSearch = process.argv[3] === '--search';

  let response;
  if (isSearch) {
    response = await callMCP('tools/call', {
      name: 'search_switch_ai',
      arguments: { query }
    });
  } else {
    response = await callMCP('tools/call', {
      name: 'query_docs_filesystem_switch_ai',
      arguments: { command: query }
    });
  }

  console.log(JSON.stringify(response, null, 2));
}

main().catch(console.error);
