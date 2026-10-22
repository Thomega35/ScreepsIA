// Usage: node scripts/relay.mjs
// Forwards main game events (colony, safe mode, errors) from the console websocket to the Discord webhook
// in WEBHOOK_URL (.env), plus an alert when the game loop goes silent.
import { inflateSync } from "node:zlib";
import { config } from "dotenv";

config();
const TOKEN = process.env.SCREEPS_TOKEN;
const SHARD = process.env.SCREEPS_SHARD || "shard3";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const HOST = "https://screeps.com";

// Reports are logged every 20 ticks: this long without any line means the loop is broken or main.js is empty
const SILENCE_MS = 30 * 60000;
const ERROR_COOLDOWN_MS = 6 * 3600000;
const FLUSH_MS = 5000;
// Colony chosen / claimer sent / claimed / done / cancelled, scouting checks, safe mode
const EVENT_PATTERN = /🚩|👁|🛡️/;

if (!TOKEN || !WEBHOOK_URL) {
  console.error("SCREEPS_TOKEN and WEBHOOK_URL are required in .env");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path) {
  const res = await fetch(`${HOST}/api/${path}`, { headers: { "X-Token": TOKEN } });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

// ---------- Discord: batched, chunked under the 2000 char limit, respects rate limits ----------
const queue = [];
let flushing = false;

function send(text) {
  queue.push(text);
}

async function postWebhook(content) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Screeps", content, allowed_mentions: { parse: [] } })
    });
    if (res.status === 429) {
      const { retry_after: retryAfter = 2 } = await res.json().catch(() => ({}));
      await sleep(retryAfter * 1000 + 100);
      continue;
    }
    if (!res.ok) console.error(`webhook -> HTTP ${res.status}`);
    else console.log(`[${new Date().toISOString()}] sent: ${content.split("\n")[0].slice(0, 120)}`);
    return;
  }
}

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const chunks = [];
    let current = "";
    for (const text of queue.splice(0)) {
      const piece = text.length > 1900 ? `${text.slice(0, 1900)}…` : text;
      if (current && current.length + piece.length + 1 > 1900) {
        chunks.push(current);
        current = "";
      }
      current += (current ? "\n" : "") + piece;
    }
    if (current) chunks.push(current);
    for (const chunk of chunks) await postWebhook(chunk);
  } finally {
    flushing = false;
  }
}
setInterval(flush, FLUSH_MS);

// ---------- Console stream ----------
const lastErrors = new Map();
let lastMessageAt = Date.now();
let silenced = false;

function cleanLine(line) {
  return String(line)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function reportError(text) {
  // Numbers (ticks, ids, positions) are ignored so the same error at another tick isn't resent
  const key = text.split("\n")[0].replace(/\d+/g, "#");
  const last = lastErrors.get(key) ?? 0;
  if (Date.now() - last < ERROR_COOLDOWN_MS) return;
  lastErrors.set(key, Date.now());
  send(`❌ **Error**\n\`\`\`\n${text.slice(0, 1500)}\n\`\`\``);
}

function handleLine(raw) {
  const isError = /color:\s*red/i.test(raw);
  const line = cleanLine(raw);
  if (!line) return;
  if (isError) {
    reportError(line);
    return;
  }
  if (EVENT_PATTERN.test(line)) send(line);
}

async function connect() {
  const me = await api("auth/me");
  const ws = new WebSocket("wss://screeps.com/socket/websocket");
  ws.onopen = () => ws.send(`auth ${TOKEN}`);
  ws.onmessage = ev => {
    const msg = String(ev.data);
    if (msg.startsWith("auth ok")) {
      ws.send(`subscribe user:${me._id}/console`);
      console.log(`[${new Date().toISOString()}] connected, relaying ${SHARD} console`);
      return;
    }
    if (msg.startsWith("auth failed")) {
      console.error("Websocket auth failed");
      process.exit(1);
    }
    if (!msg.startsWith("[") && !msg.startsWith("gz:")) return;
    let data;
    try {
      // Larger frames are sent zlib-compressed and base64-encoded
      const json = msg.startsWith("gz:") ? inflateSync(Buffer.from(msg.slice(3), "base64")).toString() : msg;
      [, data] = JSON.parse(json);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] unreadable frame skipped: ${error.message}`);
      return;
    }
    if (!data || (data.shard && data.shard !== SHARD)) return;
    const lines = data.messages?.log ?? [];
    if (lines.length > 0 || data.error) {
      lastMessageAt = Date.now();
      if (silenced) {
        silenced = false;
        send("✅ Game console is active again");
      }
    }
    for (const line of lines) handleLine(line);
    if (data.error) reportError(cleanLine(data.error));
  };
  ws.onerror = e => console.error("Websocket error", e.message ?? e);
  ws.onclose = () => {
    console.log(`[${new Date().toISOString()}] websocket closed, reconnecting in 10s`);
    setTimeout(() => connect().catch(retryConnect), 10000);
  };
}

function retryConnect(error) {
  console.error("connect failed:", error.message);
  setTimeout(() => connect().catch(retryConnect), 30000);
}

// ---------- Watchdog ----------
setInterval(() => {
  if (!silenced && Date.now() - lastMessageAt > SILENCE_MS) {
    silenced = true;
    send(`⚠️ No console output for ${SILENCE_MS / 60000} min: the game loop may be broken (empty main.js? run npm run build)`);
  }
}, 60000);

// The relay must keep running: log unexpected failures instead of exiting
process.on("uncaughtException", error => console.error(`[${new Date().toISOString()}] uncaught:`, error));
process.on("unhandledRejection", error => console.error(`[${new Date().toISOString()}] unhandled:`, error));

console.log("relay: forwarding 🚩 👁 🛡️ events and errors");
send("🔌 Relay started");
await connect().catch(retryConnect);
