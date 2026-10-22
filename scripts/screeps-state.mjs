// Usage: node scripts/screeps-state.mjs state | console [seconds]
import { config } from "dotenv";
import { gunzipSync } from "node:zlib";

config();
const TOKEN = process.env.SCREEPS_TOKEN;
const SHARD = process.env.SCREEPS_SHARD || "shard3";
const HOST = "https://screeps.com";

if (!TOKEN) {
  console.error("SCREEPS_TOKEN missing in .env");
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`${HOST}/api/${path}`, { headers: { "X-Token": TOKEN } });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function state() {
  const me = await api("auth/me");
  console.log(`User: ${me.username}  GCL: ${me.gcl}  CPU: ${me.cpu}`);

  const rooms = (await api(`user/rooms?id=${me._id}`)).shards?.[SHARD] ?? [];
  console.log(`Rooms on ${SHARD}: ${rooms.join(", ") || "none"}`);

  for (const room of rooms) {
    const { objects } = await api(`game/room-objects?room=${room}&shard=${SHARD}`);
    const mine = objects.filter(o => o.user === me._id);
    console.log(`\n=== ${room} ===`);
    for (const o of mine.filter(o => ["spawn", "extension", "controller", "tower", "storage", "link"].includes(o.type))) {
      const energy = o.store ? ` energy ${o.store.energy ?? 0}/${o.storeCapacityResource?.energy ?? o.storeCapacity ?? "?"}` : "";
      const extra = o.type === "controller" ? ` lvl ${o.level} progress ${o.progress}/${o.progressTotal}` : "";
      const spawning = o.spawning ? ` spawning ${o.spawning.name}` : "";
      console.log(`${o.type} ${o.name ?? ""} @${o.x},${o.y}${energy}${extra}${spawning}`);
    }
    const creeps = mine.filter(o => o.type === "creep");
    console.log(`Creeps: ${creeps.length}`);
    for (const c of creeps) {
      const body = c.body.map(p => p.type[0]).join("");
      console.log(`  ${c.name} @${c.x},${c.y} hits ${c.hits}/${c.hitsMax} ttl ${c.ageTime ? c.ageTime : "?"} body ${body} energy ${c.store?.energy ?? 0}`);
    }
    const sites = objects.filter(o => o.type === "constructionSite" && o.user === me._id);
    console.log(`Construction sites: ${sites.length}`);
    for (const s of sites) console.log(`  ${s.structureType} @${s.x},${s.y} ${s.progress}/${s.progressTotal}`);
    for (const o of objects.filter(o => o.type === "energy" || o.type === "source")) {
      const amount = o.type === "energy" ? `${o.resourceType ?? "energy"} ${o.amount ?? o.energy}` : `${o.energy}/${o.energyCapacity}`;
      console.log(`${o.type} @${o.x},${o.y} ${amount}`);
    }
  }

  const mem = await api(`user/memory?shard=${SHARD}`);
  const raw = typeof mem.data === "string" && mem.data.startsWith("gz:")
    ? gunzipSync(Buffer.from(mem.data.slice(3), "base64")).toString()
    : JSON.stringify(mem.data);
  console.log(`\n=== Memory (${raw.length} chars) ===`);
  console.log(raw.length > 20000 ? raw.slice(0, 20000) + "\n...truncated" : raw);
}

async function streamConsole(seconds) {
  const me = await api("auth/me");
  const ws = new WebSocket("wss://screeps.com/socket/websocket");
  ws.onopen = () => ws.send(`auth ${TOKEN}`);
  ws.onmessage = ev => {
    const msg = String(ev.data);
    if (msg.startsWith("auth ok")) {
      ws.send(`subscribe user:${me._id}/console`);
      console.log(`Listening to console for ${seconds}s...`);
      return;
    }
    if (msg.startsWith("auth failed")) {
      console.error("Websocket auth failed");
      process.exit(1);
    }
    if (!msg.startsWith("[")) return;
    const [, data] = JSON.parse(msg);
    if (data.shard && data.shard !== SHARD) return;
    for (const line of data.messages?.log ?? []) console.log(line);
    for (const line of data.messages?.results ?? []) console.log(`> ${line}`);
    if (data.error) console.log(`ERROR: ${data.error}`);
  };
  ws.onerror = e => console.error("Websocket error", e.message ?? e);
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, seconds * 1000);
}

const [cmd = "state", arg] = process.argv.slice(2);
if (cmd === "console") await streamConsole(Number(arg) || 15);
else await state();
