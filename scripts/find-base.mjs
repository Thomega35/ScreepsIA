// Usage: node scripts/find-base.mjs [--radius 10] [--max-route 15] [--top 10] [--home W6S1] [--verbose]
// Ranks unclaimed rooms around your bases for a new colony, using the Screeps web API (read-only, cached).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config();
const TOKEN = process.env.SCREEPS_TOKEN;
const SHARD = process.env.SCREEPS_SHARD || "shard3";
const HOST = "https://screeps.com";
const CACHE_DIR = "scripts/.cache";
const OBJECTS_TTL = 6 * 3600 * 1000;
// A claimer lives 600 ticks: beyond ~12 rooms it may die on the way
const CLAIMER_SAFE_ROUTE = 12;

if (!TOKEN) {
  console.error("SCREEPS_TOKEN missing in .env");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map(a => a.trim().split(/\s+/))
);
const RADIUS = Number(args.radius ?? 10);
const MAX_ROUTE = Number(args["max-route"] ?? 15);
const TOP = Number(args.top ?? 10);

// ---------- API with rate limit handling and disk cache ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path, options = {}) {
  for (;;) {
    const res = await fetch(`${HOST}/api/${path}`, {
      ...options,
      headers: { "X-Token": TOKEN, "Content-Type": "application/json", ...(options.headers ?? {}) }
    });
    if (res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
      const wait = Math.min(Math.max(reset - Date.now(), 5000), 120000);
      process.stderr.write(`rate limited on ${path.split("?")[0]}, waiting ${Math.round(wait / 1000)}s\n`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  }
}

async function cached(name, ttl, fetcher) {
  const file = `${CACHE_DIR}/${SHARD}-${name}.json`;
  if (existsSync(file)) {
    const { time, data } = JSON.parse(readFileSync(file, "utf8"));
    if (ttl === Infinity || Date.now() - time < ttl) return data;
  }
  const data = await fetcher();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ time: Date.now(), data }));
  await sleep(250);
  return data;
}

const getTerrain = room =>
  cached(`terrain-${room}`, Infinity, async () => {
    const res = await api(`game/room-terrain?room=${room}&shard=${SHARD}&encoded=1`);
    return res.terrain?.[0]?.terrain ?? null;
  });

const getObjects = room =>
  cached(`objects-${room}`, OBJECTS_TTL, async () => {
    const res = await api(`game/room-objects?room=${room}&shard=${SHARD}`);
    return (res.objects ?? [])
      .filter(o => ["source", "controller", "mineral", "keeperLair", "invaderCore"].includes(o.type))
      .map(o => ({
        type: o.type,
        x: o.x,
        y: o.y,
        user: o.user ?? null,
        level: o.level ?? 0,
        reservation: o.reservation?.user ?? null,
        mineralType: o.mineralType ?? null
      }));
  });

// ---------- Room geometry ----------
function parseRoom(name) {
  const m = /^([WE])(\d+)([NS])(\d+)$/.exec(name);
  return {
    x: m[1] === "W" ? -Number(m[2]) - 1 : Number(m[2]),
    y: m[3] === "N" ? -Number(m[4]) - 1 : Number(m[4]),
    h: Number(m[2]),
    v: Number(m[4])
  };
}

function roomName(x, y) {
  return `${x < 0 ? `W${-x - 1}` : `E${x}`}${y < 0 ? `N${-y - 1}` : `S${y}`}`;
}

function roomKind(name) {
  const { h, v } = parseRoom(name);
  if (h % 10 === 0 || v % 10 === 0) return "highway";
  const a = h % 10;
  const b = v % 10;
  if (a >= 4 && a <= 6 && b >= 4 && b <= 6) return a === 5 && b === 5 ? "center" : "keeper";
  return "normal";
}

const DIRS = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

function isWall(terrain, x, y) {
  return (Number(terrain[y * 50 + x]) & 1) === 1;
}

function openSides(terrain) {
  const sides = {};
  for (const side of Object.keys(DIRS)) {
    sides[side] = false;
    for (let i = 1; i < 49; i++) {
      const [x, y] = { top: [i, 0], bottom: [i, 49], left: [0, i], right: [49, i] }[side];
      if (!isWall(terrain, x, y)) sides[side] = true;
    }
  }
  return sides;
}

// Best spot for a compact base: most buildable tiles (swamp counts half) in a 13x13 square away from the edges
function baseFit(terrain) {
  const SIZE = 13;
  const half = (SIZE - 1) / 2;
  const prefix = (fn) => {
    const p = Array.from({ length: 51 }, () => new Float64Array(51));
    for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) p[y + 1][x + 1] = fn(x, y) + p[y][x + 1] + p[y + 1][x] - p[y][x];
    return (x0, y0, x1, y1) => p[y1 + 1][x1 + 1] - p[y0][x1 + 1] - p[y1 + 1][x0] + p[y0][x0];
  };
  const open = prefix((x, y) => (isWall(terrain, x, y) ? 0 : 1));
  const swamp = prefix((x, y) => (Number(terrain[y * 50 + x]) === 2 ? 1 : 0));
  let best = { score: -1 };
  for (let cy = 3 + half; cy <= 46 - half; cy++) {
    for (let cx = 3 + half; cx <= 46 - half; cx++) {
      const o = open(cx - half, cy - half, cx + half, cy + half);
      const s = swamp(cx - half, cy - half, cx + half, cy + half);
      const score = (o - 0.5 * s) / (SIZE * SIZE);
      if (score > best.score) best = { score, x: cx, y: cy, swamp: s / (SIZE * SIZE) };
    }
  }
  return best;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// ---------- Main ----------
const me = await api("auth/me");
const gclLevel = Math.floor((me.gcl / 1e6) ** (1 / 2.4)) + 1;
const owned = args.home ? [args.home] : ((await api(`user/rooms?id=${me._id}`)).shards?.[SHARD] ?? []);
if (owned.length === 0) {
  console.error(`No owned room on ${SHARD}; pass --home ROOM`);
  process.exit(1);
}
console.log(`${me.username}: GCL ${gclLevel}, ${owned.length} room(s) owned on ${SHARD} (${owned.join(", ")})`);
if (owned.length >= gclLevel) console.log("Warning: GCL is maxed, you can't claim another room yet.");

// Rooms to inspect: radius around every owned room (+1 ring to score remote mining)
const area = new Set();
for (const home of owned) {
  const { x, y } = parseRoom(home);
  for (let dx = -RADIUS - 1; dx <= RADIUS + 1; dx++) {
    for (let dy = -RADIUS - 1; dy <= RADIUS + 1; dy++) area.add(roomName(x + dx, y + dy));
  }
}
const rooms = [...area];

const stats = await api("game/map-stats", {
  method: "POST",
  body: JSON.stringify({ rooms, statName: "owner0", shard: SHARD })
});
const users = stats.users ?? {};
const now = Date.now();
const info = new Map();
let done = 0;
for (const name of rooms) {
  const s = stats.stats?.[name] ?? {};
  const closed =
    s.status !== "normal" || (s.novice && s.novice > now) || (s.respawnArea && s.respawnArea > now) || (s.openTime && s.openTime > now);
  const terrain = closed ? null : await getTerrain(name);
  const kind = roomKind(name);
  const objects = terrain && kind !== "highway" ? await getObjects(name) : [];
  const controller = objects.find(o => o.type === "controller");
  // map-stats also reports reservations as owners (level 0), so ownership comes from the controller
  const ownerId = controller?.user ?? (s.own?.level > 0 ? s.own.user : null);
  info.set(name, {
    name,
    kind,
    closed,
    terrain,
    objects,
    owner: ownerId ? (users[ownerId]?.username ?? ownerId) : null,
    ownerLevel: controller?.level ?? s.own?.level ?? 0,
    reservedBy: controller?.reservation ? (users[controller.reservation]?.username ?? "Invader") : null,
    sides: terrain ? openSides(terrain) : null
  });
  process.stderr.write(`\rscanned ${++done}/${rooms.length} rooms`);
}
process.stderr.write("\n");

const isMine = r => r.owner === me.username;
const isHostile = r => r.owner && !isMine(r) && r.ownerLevel > 0;

function neighbors(name) {
  const r = info.get(name);
  if (!r?.sides) return [];
  const { x, y } = parseRoom(name);
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
  return Object.entries(DIRS)
    .filter(([side]) => r.sides[side])
    .map(([side, [dx, dy]]) => ({ side, n: info.get(roomName(x + dx, y + dy)) }))
    .filter(({ side, n }) => n?.sides?.[opposite[side]])
    .map(({ n }) => n.name);
}

// Route length from the closest owned room, never through another player's base
const steps = new Map(owned.map(r => [r, 0]));
const queue = [...owned];
for (const name of queue) {
  for (const n of neighbors(name)) {
    if (!steps.has(n) && !isHostile(info.get(n))) {
      steps.set(n, steps.get(name) + 1);
      queue.push(n);
    }
  }
}

const homeMinerals = new Set(owned.flatMap(r => info.get(r)?.objects.filter(o => o.type === "mineral").map(o => o.mineralType) ?? []));
const nearHome = new Set(owned.flatMap(r => [r, ...neighbors(r)]));

const results = [];
for (const r of info.values()) {
  const sources = r.objects.filter(o => o.type === "source");
  const controller = r.objects.find(o => o.type === "controller");
  const dist = steps.get(r.name);
  const reason =
    r.kind !== "normal"
      ? null
      : r.closed
        ? "closed (novice/respawn zone)"
        : !controller
          ? null
          : r.owner
            ? `owned by ${r.owner}`
            : sources.length < 2
              ? null
              : dist === undefined
                ? "unreachable without crossing another player's base"
                : dist > MAX_ROUTE
                  ? `too far (${dist} rooms)`
                  : "";
  if (reason) {
    if ("verbose" in args) console.log(`skip ${r.name}: ${reason}`);
    continue;
  }
  if (reason === null) {
    continue;
  }
  const notes = [];
  let score = 100;
  if (dist > CLAIMER_SAFE_ROUTE) {
    notes.push("far: claimer may run out of life on the way");
  }

  if (r.reservedBy && r.reservedBy !== me.username) {
    score -= r.reservedBy === "Invader" ? 10 : 40;
    notes.push(r.reservedBy === "Invader" ? "invader reservation (core to kill)" : `reserved by ${r.reservedBy}`);
  }

  // Far rooms are fine, close ones fight the home base for the same remote rooms
  if (dist === 1) {
    score -= 15;
    notes.push("adjacent to a base");
  } else if (dist > 3) {
    score -= dist - 3;
  }

  // Remote mining: sources in connected free rooms not already next to one of our bases
  let remoteSources = 0;
  const remotes = [];
  for (const n of neighbors(r.name)) {
    const nr = info.get(n);
    if (nr.kind !== "normal" || nr.owner || nearHome.has(n) || (nr.reservedBy && nr.reservedBy !== me.username)) continue;
    const count = nr.objects.filter(o => o.type === "source").length;
    if (count > 0) {
      remoteSources += count;
      remotes.push(`${n}(${count})`);
    }
  }
  score += remoteSources * 8;
  if (neighbors(r.name).some(n => info.get(n).kind === "keeper")) notes.push("next to a keeper room");

  const fit = baseFit(r.terrain);
  score += Math.round((fit.score - 0.7) * 100);
  if (fit.swamp > 0.3) notes.push(`swampy core (${Math.round(fit.swamp * 100)}%)`);

  // Logistics: haul distance from the base core to sources and controller
  const haul = sources.reduce((sum, s) => sum + cheb(s, fit), 0) + cheb(controller, fit);
  score -= Math.max(0, haul - 30);

  const mineral = r.objects.find(o => o.type === "mineral")?.mineralType ?? "?";
  if (!homeMinerals.has(mineral)) {
    score += 10;
  } else {
    notes.push(`same mineral as home (${mineral})`);
  }
  if (mineral === "X") score += 5;

  // Fewer exits are easier to defend
  const exits = Object.values(r.sides).filter(Boolean).length;
  score += (4 - exits) * 4;

  // Hostile players within 2 rooms (informative only)
  const { x, y } = parseRoom(r.name);
  const threats = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const n = info.get(roomName(x + dx, y + dy));
      if (n && isHostile(n)) threats.push(`${n.owner}@${n.name}(RCL${n.ownerLevel})`);
    }
  }
  if (r.objects.some(o => o.type === "invaderCore")) {
    score -= 20;
    notes.push("invader core");
  }

  results.push({
    room: r.name,
    score: Math.round(score),
    dist,
    mineral,
    remotes: `${remoteSources} ${remotes.join(" ")}`.trim(),
    core: `${fit.x},${fit.y} ${Math.round(fit.score * 100)}%`,
    haul,
    exits,
    threats: threats.join(" "),
    notes: notes.join("; ")
  });
}

results.sort((a, b) => b.score - a.score);
console.log(`\n${results.length} candidate rooms with 2 sources within ${MAX_ROUTE} rooms (scan radius ${RADIUS}):\n`);
// Plain text: console.table box characters are garbled in Windows PowerShell
for (const r of results.slice(0, TOP)) {
  console.log(`${r.room.padEnd(7)} score ${String(r.score).padStart(4)} | ${r.dist} rooms away | mineral ${r.mineral} | ${r.exits} exits`);
  console.log(`        core ${r.core}, haul ${r.haul} | remote sources: ${r.remotes}`);
  if (r.threats) console.log(`        hostiles: ${r.threats}`);
  if (r.notes) console.log(`        notes: ${r.notes}`);
}
console.log(
  "score: 100 base, +8/remote source, +core openness, -haul distance, +10 new mineral, +4/closed exit, -15 adjacent, -1/room beyond 3"
);
