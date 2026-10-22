import { myUsername, routeCost } from "script.expansion";

// In-game version of scripts/find-base.mjs: scouts record room intel, then the best room is picked automatically
const SCOUT_RADIUS = 6;
// Once the colony area is known, idle scouts keep exploring up to this distance
const FAR_SCOUT_RADIUS = 12;
// A claimer lives 600 ticks: beyond ~10 rooms it may die on the way
const MAX_ROUTE = 10;
const INTEL_TTL = 50000;
const RECORD_INTERVAL = 1000;
const BASE_SIZE = 13;

export interface RoomIntel {
  time: number;
  unreachable?: boolean;
  sources?: { x: number; y: number }[];
  controller?: { x: number; y: number };
  owner?: string;
  reserver?: string;
  mineral?: MineralConstant;
  invaderCore?: boolean;
  // Controller walled off by another player's walls/ramparts; undefined until seen by a creep (API intel can't tell)
  sealed?: boolean;
}

function coords(name: string) {
  const m = /^([WE])(\d+)([NS])(\d+)$/.exec(name);
  if (!m) {
    return null;
  }
  return {
    x: m[1] === "W" ? -Number(m[2]) - 1 : Number(m[2]),
    y: m[3] === "N" ? -Number(m[4]) - 1 : Number(m[4]),
    h: Number(m[2]) % 10,
    v: Number(m[4]) % 10
  };
}

function roomName(x: number, y: number): string {
  return `${x < 0 ? `W${-x - 1}` : `E${x}`}${y < 0 ? `N${-y - 1}` : `S${y}`}`;
}

// Not a highway, keeper or centre room
function isNormalRoom(name: string): boolean {
  const c = coords(name);
  return !!c && c.h !== 0 && c.v !== 0 && !(c.h >= 4 && c.h <= 6 && c.v >= 4 && c.v <= 6);
}

// Heap cache: room statuses don't change during a global
const areaCache = new Map<string, string[]>();
function areaRooms(home: string, radius = SCOUT_RADIUS): string[] {
  const key = `${home}:${radius}`;
  let rooms = areaCache.get(key);
  if (!rooms) {
    const c = coords(home);
    const status = Game.map.getRoomStatus(home)?.status;
    rooms = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const name = c ? roomName(c.x + dx, c.y + dy) : home;
        if (isNormalRoom(name) && Game.map.getRoomStatus(name)?.status === status) {
          rooms.push(name);
        }
      }
    }
    areaCache.set(key, rooms);
  }
  return rooms;
}

function isFresh(name: string): boolean {
  const intel = Memory.intel?.[name];
  return !!intel && Game.time - intel.time < INTEL_TTL;
}

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// True when no walkable path leads from the room exits to a tile next to the controller
function isSealed(room: Room, controller: StructureController): boolean {
  const terrain = room.getTerrain();
  const blocked = new Uint8Array(2500);
  for (const s of room.find(FIND_STRUCTURES)) {
    const walkable =
      s.structureType === STRUCTURE_ROAD ||
      s.structureType === STRUCTURE_CONTAINER ||
      (s.structureType === STRUCTURE_RAMPART && (s.my || s.isPublic));
    if (!walkable) {
      blocked[s.pos.y * 50 + s.pos.x] = 1;
    }
  }
  const open = (x: number, y: number) =>
    x >= 0 && x <= 49 && y >= 0 && y <= 49 && !blocked[y * 50 + x] && terrain.get(x, y) !== TERRAIN_MASK_WALL;
  const seen = new Uint8Array(2500);
  const queue: number[] = [];
  for (let i = 0; i < 50; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, 49],
      [0, i],
      [49, i]
    ]) {
      if (open(x, y) && !seen[y * 50 + x]) {
        seen[y * 50 + x] = 1;
        queue.push(y * 50 + x);
      }
    }
  }
  // Breadth-first: the loop also visits tiles pushed while iterating
  for (const tile of queue) {
    const x = tile % 50;
    const y = (tile - x) / 50;
    if (cheb({ x, y }, controller.pos) <= 1) {
      return false;
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = (y + dy) * 50 + x + dx;
        if (open(x + dx, y + dy) && !seen[key]) {
          seen[key] = 1;
          queue.push(key);
        }
      }
    }
  }
  return true;
}

// Best spot for a compact base: most buildable tiles (swamp counts half) in a 13x13 square away from the edges
function baseFit(name: string) {
  const terrain = Game.map.getRoomTerrain(name);
  const prefixSum = (value: (x: number, y: number) => number) => {
    const p = new Float64Array(51 * 51);
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        p[(y + 1) * 51 + x + 1] = value(x, y) + p[y * 51 + x + 1] + p[(y + 1) * 51 + x] - p[y * 51 + x];
      }
    }
    return (x0: number, y0: number, x1: number, y1: number) =>
      p[(y1 + 1) * 51 + x1 + 1] - p[y0 * 51 + x1 + 1] - p[(y1 + 1) * 51 + x0] + p[y0 * 51 + x0];
  };
  const open = prefixSum((x, y) => (terrain.get(x, y) === TERRAIN_MASK_WALL ? 0 : 1));
  const swamp = prefixSum((x, y) => (terrain.get(x, y) === TERRAIN_MASK_SWAMP ? 1 : 0));
  const half = (BASE_SIZE - 1) / 2;
  let best = { score: -1, x: 25, y: 25 };
  for (let cy = 3 + half; cy <= 46 - half; cy++) {
    for (let cx = 3 + half; cx <= 46 - half; cx++) {
      const o = open(cx - half, cy - half, cx + half, cy + half);
      const s = swamp(cx - half, cy - half, cx + half, cy + half);
      const score = (o - 0.5 * s) / (BASE_SIZE * BASE_SIZE);
      if (score > best.score) {
        best = { score, x: cx, y: cy };
      }
    }
  }
  // The spawn needs a non-wall tile close to the centre
  for (let range = 0; range <= half; range++) {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const x = best.x + dx;
        const y = best.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) === range && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
          return { score: best.score, x, y };
        }
      }
    }
  }
  return best;
}

function scoreRoom(name: string, homes: string[], homeMinerals: Set<string>, nearHome: Set<string>) {
  const me = myUsername();
  const intel = Memory.intel?.[name];
  if (
    !intel?.controller ||
    !intel.sources ||
    intel.sources.length < 2 ||
    intel.owner ||
    intel.invaderCore ||
    intel.sealed ||
    (intel.reserver && intel.reserver !== "Invader" && intel.reserver !== me)
  ) {
    return null;
  }
  // Distance from the closest expansion room
  const dist = Math.min(
    ...homes.map(home => {
      const route = Game.map.findRoute(home, name, { routeCallback: routeCost });
      return route === ERR_NO_PATH ? Infinity : route.length;
    })
  );
  if (dist > MAX_ROUTE) {
    return null;
  }
  let score = 100;
  // Far rooms are fine, close ones fight the home base for the same remote rooms
  if (dist === 1) {
    score -= 15;
  } else if (dist > 3) {
    score -= dist - 3;
  }
  if (intel.reserver === "Invader") {
    score -= 10;
  }
  const fit = baseFit(name);
  score += (fit.score - 0.7) * 100;
  const haul = intel.sources.reduce((sum, s) => sum + cheb(s, fit), 0) + cheb(intel.controller, fit);
  score -= Math.max(0, haul - 30);
  if (intel.mineral && !homeMinerals.has(intel.mineral)) {
    score += 10;
  }
  // Fewer exits are easier to defend; free neighbours can be remote mined
  const exits = Object.values(Game.map.describeExits(name) ?? {});
  score += (4 - exits.length) * 4;
  for (const n of exits) {
    const ni = Memory.intel?.[n];
    if (ni && !ni.owner && !nearHome.has(n) && (!ni.reserver || ni.reserver === me)) {
      score += 8 * (ni.sources?.length ?? 0);
    }
  }
  const c = coords(name);
  for (let dx = -2; dx <= 2 && c; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const owner = Memory.roomOwners?.[roomName(c.x + dx, c.y + dy)];
      if (owner && owner !== me) {
        score -= 5;
      }
    }
  }
  return { room: name, x: fit.x, y: fit.y, score };
}

export const ScoutScript = {
  isFresh,
  // Merges intel posted by scripts/seed-intel.mjs; a separate key so the game never overwrites it mid-upload
  importIntel() {
    const data = Memory.intelImport;
    if (!data) {
      return;
    }
    Memory.intel ??= {};
    Memory.roomOwners ??= {};
    for (const [name, intel] of Object.entries(data.intel ?? {})) {
      const old = Memory.intel[name];
      if (!old || old.time < intel.time) {
        Memory.intel[name] = intel;
      }
    }
    for (const [name, owner] of Object.entries(data.owners ?? {})) {
      if (Game.rooms[name]) {
        continue;
      }
      if (owner) {
        Memory.roomOwners[name] = owner;
      } else {
        delete Memory.roomOwners[name];
      }
    }
    console.log(`[${Game.time}] 👁 imported intel for ${Object.keys(data.intel ?? {}).length} rooms`);
    delete Memory.intelImport;
  },
  // Sources, controller, owner and mineral of every visible room
  recordIntel() {
    Memory.intel ??= {};
    for (const room of Object.values(Game.rooms)) {
      const controller = room.controller;
      const old = Memory.intel[room.name];
      // API-imported intel is re-recorded on first sight to learn whether the controller is reachable
      if (
        !controller ||
        (old && !old.unreachable && old.sealed !== undefined && Game.time - old.time < RECORD_INTERVAL)
      ) {
        continue;
      }
      Memory.intel[room.name] = {
        time: Game.time,
        sources: room.find(FIND_SOURCES).map(s => ({ x: s.pos.x, y: s.pos.y })),
        controller: { x: controller.pos.x, y: controller.pos.y },
        owner: controller.owner?.username,
        reserver: controller.reservation?.username,
        mineral: room.find(FIND_MINERALS)[0]?.mineralType,
        invaderCore:
          room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } }).length > 0,
        sealed: !controller.my && isSealed(room, controller)
      };
      if (Memory.scoutTarget === room.name) {
        delete Memory.scoutTarget;
      }
    }
  },
  markUnreachable(name: string) {
    Memory.intel ??= {};
    Memory.intel[name] = { ...Memory.intel[name], time: Game.time, unreachable: true };
    if (Memory.scoutTarget === name) {
      delete Memory.scoutTarget;
    }
  },
  needsScouting(home: string): boolean {
    return !!Memory.scoutTarget || areaRooms(home).some(name => !isFresh(name));
  },
  // Unknown rooms of the colony area first, then farther unknown rooms, then the oldest intel
  nextScoutRoom(home: string, from: string): string | undefined {
    if (Memory.scoutTarget) {
      return Memory.scoutTarget;
    }
    const dist = (name: string) =>
      Game.map.getRoomLinearDistance(from, name) * 100 + Game.map.getRoomLinearDistance(home, name);
    const closest = (rooms: string[]) => rooms.sort((a, b) => dist(a) - dist(b))[0];
    const far = areaRooms(home, FAR_SCOUT_RADIUS);
    const age = (name: string) => Memory.intel?.[name]?.time ?? 0;
    return (
      closest(areaRooms(home).filter(name => !isFresh(name))) ??
      closest(far.filter(name => !isFresh(name))) ??
      far.filter(name => name !== from && !Memory.roomOwners?.[name]).sort((a, b) => age(a) - age(b))[0]
    );
  },
  // Best room to colonise from any of `homes`, or undefined if none qualifies
  chooseTarget(homes: string[]): { room: string; x: number; y: number; score: number } | undefined {
    const owned = Object.values(Game.rooms).filter(r => r.controller?.my);
    const homeMinerals = new Set<string>(owned.flatMap(r => r.find(FIND_MINERALS).map(m => m.mineralType)));
    const nearHome = new Set(owned.flatMap(r => [r.name, ...Object.values(Game.map.describeExits(r.name) ?? {})]));
    let best: ReturnType<typeof scoreRoom> = null;
    for (const name of new Set(homes.flatMap(home => areaRooms(home)))) {
      const result = scoreRoom(name, homes, homeMinerals, nearHome);
      if (result && (!best || result.score > best.score)) {
        best = result;
      }
    }
    return best ?? undefined;
  }
};
