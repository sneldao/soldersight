// Minimal stdio MCP client for the local @heypcb/mcp server.
// Usage:
//   node heypcb/mcp.mjs tools/list
//   node heypcb/mcp.mjs whoami '{}'
//   node heypcb/mcp.mjs build_board '{"brief":"..."}'
// Prints the raw JSON-RPC response (trimmed) to stdout.
import { spawn } from "node:child_process";

const method = process.argv[2];
const toolName = process.argv[3];
let args = {};
if (method === "tools/call") args = JSON.parse(process.argv[4] || "{}");

const child = spawn("npx", ["-y", "@heypcb/mcp"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (d) => {
  buf += d;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* non-JSON line */ }
  }
});

function send(obj, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const id = obj.id ?? nextId++;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, ...obj }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error("timeout waiting for id " + id)); }
    }, timeoutMs);
  });
}

await send({
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "soldersight", version: "1.0.0" },
  },
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

if (method === "tools/list") {
  const r = await send({ method: "tools/list" });
  const tools = (r.result?.tools || []).map((t) => ({ name: t.name, desc: (t.description || "").slice(0, 2000), schema: t.inputSchema }));
  console.log(JSON.stringify(tools, null, 1));
} else if (method === "tools/call") {
  const r = await send({ method: "tools/call", params: { name: toolName, arguments: args } });
  console.log(JSON.stringify(r, null, 1));
} else {
  console.error("unknown method:", method);
  process.exitCode = 1;
}
child.kill();
process.exit(0);
