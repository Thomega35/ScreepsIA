// Usage: node scripts/seed-intel.mjs [--dry-run]
// Uploads the room data cached by find-base.mjs into Memory.intelImport, so scouts skip rooms already known.
// The game merges it into Memory.intel / Memory.roomOwners on its next tick, then deletes it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { config } from "dotenv";

config();
const TOKEN = process.env.SCREEPS_TOKEN;
const SHARD = process.env.SCREEPS_SHARD || "shard3";
const HOST = "https://screeps.com";
const CACHE_DIR = "scripts/.cache";
const DRY_RUN = process.argv.includes("--dry-run");

if (!TOKEN) {
  console.error("SCREEPS_TOKEN missing in .env");
  process.exit(1);
}

async function api(path, options = {}) {
  const res = await fetch(`${HOST}/api/${path}`, {
    ...options,
    headers: { "X-Token": TOKEN, "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

const prefix = `${SHARD}-objects-`;
const files = existsSync(CACHE_DIR) ? readdirSync(CACHE_DIR).filter(f => f.startsWith(prefix)) : [];
if (files.length === 0) {
  console.error(`No cached rooms in ${CACHE_DIR}: run node scripts/find-base.mjs first`);
  process.exit(1);
}

const { time: gameTime } = await api(`game/time?shard=${SHARD}`);
const shardInfo = await api("game/shards/info").catch(() => null);
const tickMs = shardInfo?.shards?.find(s => s.name === SHARD)?.tick || 4000;

const rooms = files.map(f => {
  const { time, data } = JSON.parse(readFileSync(`${CACHE_DIR}/${f}`, "utf8"));
  return { name: f.slice(prefix.length, -".json".length), time, objects: data };
});
const withController = rooms.filter(r => r.objects.some(o => o.type === "controller"));

const stats = await api("game/map-stats", {
  method: "POST",
  body: JSON.stringify({ rooms: withController.map(r => r.name), statName: "owner0", shard: SHARD })
});
const users = stats.users ?? {};
const username = id => users[id]?.username;

const intel = {};
const owners = {};
for (const r of withController) {
  const controller = r.objects.find(o => o.type === "controller");
  const owner = controller.user ? (username(controller.user) ?? controller.user) : undefined;
  // Same shape as ScoutScript.recordIntel; age converted from wall clock to ticks
  intel[r.name] = {
    time: gameTime - Math.round((Date.now() - r.time) / tickMs),
    sources: r.objects.filter(o => o.type === "source").map(({ x, y }) => ({ x, y })),
    controller: { x: controller.x, y: controller.y },
    ...(owner && { owner }),
    ...(controller.reservation && { reserver: username(controller.reservation) ?? "Invader" }),
    ...(r.objects.find(o => o.type === "mineral")?.mineralType && {
      mineral: r.objects.find(o => o.type === "mineral").mineralType
    }),
    ...(r.objects.some(o => o.type === "invaderCore") && { invaderCore: true })
  };
  owners[r.name] = owner ?? null;
}

const owned = Object.values(owners).filter(Boolean).length;
const oldest = Math.max(...withController.map(r => Date.now() - r.time)) / 3600000;
console.log(`${withController.length} rooms (${owned} owned), cache up to ${oldest.toFixed(1)}h old, game tick ${gameTime}`);

const value = { intel, owners };
console.log(`payload ${(JSON.stringify(value).length / 1024).toFixed(1)} KB`);
if (DRY_RUN) {
  console.log(JSON.stringify(Object.entries(intel).slice(0, 3)));
  process.exit(0);
}

await api("user/memory", { method: "POST", body: JSON.stringify({ path: "intelImport", value, shard: SHARD }) });

// The write is queued as a console command for the next tick, then the game merges it: poll Memory.intel
const memoryJson = async path => {
  const { data } = await api(`user/memory?path=${path}&shard=${SHARD}`);
  const raw = typeof data === "string" && data.startsWith("gz:") ? gunzipSync(Buffer.from(data.slice(3), "base64")).toString() : null;
  return raw ? JSON.parse(raw) : null;
};
const wanted = Object.keys(intel);
for (let attempt = 0; attempt < 15; attempt++) {
  await new Promise(r => setTimeout(r, 4000));
  const known = await memoryJson("intel");
  const merged = wanted.filter(name => known?.[name] && known[name].time >= intel[name].time).length;
  if (merged === wanted.length) {
    console.log(`Merged: Memory.intel has all ${merged} rooms`);
    process.exit(0);
  }
  const pending = await memoryJson("intelImport");
  console.log(`waiting... ${merged}/${wanted.length} rooms merged${pending ? ", import pending (is the new code deployed?)" : ""}`);
}
console.log("Not merged after 60s: check the game console for errors, or run again");
