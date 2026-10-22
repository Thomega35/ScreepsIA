import { CreepScript } from "script.creep";
import { ScoutScript } from "script.scouting";

// Claiming a new room: set Memory.claim = { room, x, y } (works without vision) or place a flag named "claim",
// at the spot of the new room's first spawn. The strongest owned rooms send a claimer, then pioneers that build the spawn.
// The target is cleared once the spawn exists. Without a target, scouts map the area and the best room is picked.
export const CLAIM_FLAG = "claim";
const CHOOSE_INTERVAL = 100;
const CHOOSE_MIN_BUCKET = 2000;
const PIONEERS = 3;
const CLAIMER_BODY: BodyPartConstant[] = [CLAIM, MOVE, MOVE];
const PIONEER_PATTERN: BodyPartConstant[] = [WORK, CARRY, MOVE, MOVE];
const PIONEER_MAX_PATTERNS = 5;
// From this RCL, every room at the colony's max level takes part; below it only the strongest one does
const SHARED_EXPANSION_LEVEL = 7;

// Heap: roles spawned this tick, as new creeps only show up in Game.creeps next tick
const spawnedThisTick = { tick: -1, roles: [] as string[] };
function spawnedNow(role: string): number {
  return spawnedThisTick.tick === Game.time ? spawnedThisTick.roles.filter(r => r === role).length : 0;
}
function spawnExpansionCreep(spawn: StructureSpawn, body: BodyPartConstant[], name: string, memory: CreepMemory) {
  const result = spawn.spawnCreep(body, name, { memory });
  if (result === OK) {
    if (spawnedThisTick.tick !== Game.time) {
      spawnedThisTick.tick = Game.time;
      spawnedThisTick.roles = [];
    }
    spawnedThisTick.roles.push(memory.role);
  }
  return result;
}

export function myUsername(): string | undefined {
  return Object.values(Game.spawns)[0]?.owner.username;
}

// Highways are never owned and are the safest roads; other players' rooms and keeper rooms are never crossed
export function routeCost(roomName: string): number {
  const owner = Memory.roomOwners?.[roomName];
  if (owner && owner !== myUsername()) {
    return Infinity;
  }
  const match = /^[WE](\d+)[NS](\d+)$/.exec(roomName);
  if (!match) {
    return Infinity;
  }
  const h = Number(match[1]) % 10;
  const v = Number(match[2]) % 10;
  if (h === 0 || v === 0) {
    return 1;
  }
  const keeper = h >= 4 && h <= 6 && v >= 4 && v <= 6 && !(h === 5 && v === 5);
  return keeper ? Infinity : 2.5;
}

function canClaimMore(): boolean {
  return Object.values(Game.rooms).filter(r => r.controller?.my).length < Game.gcl.level;
}

function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}

function claimTarget(): RoomPosition | null {
  const flag = Game.flags[CLAIM_FLAG];
  if (flag) {
    return flag.pos;
  }
  const claim = Memory.claim;
  return claim ? new RoomPosition(claim.x, claim.y, claim.room) : null;
}

// Owned rooms with spawns that send the expansion creeps
function expansionHomes(target?: string): string[] {
  const rooms = Object.values(Game.rooms)
    .filter(r => r.name !== target && r.controller?.my && r.find(FIND_MY_SPAWNS).length > 0)
    .sort((a, b) => (b.controller?.level ?? 0) - (a.controller?.level ?? 0));
  const maxLevel = rooms[0]?.controller?.level ?? 0;
  if (maxLevel < SHARED_EXPANSION_LEVEL) {
    return rooms.slice(0, 1).map(r => r.name);
  }
  return rooms.filter(r => r.controller?.level === maxLevel).map(r => r.name);
}

function routeLength(from: string, to: string): number {
  const route = Game.map.findRoute(from, to, { routeCallback: routeCost });
  return route === ERR_NO_PATH ? Infinity : route.length;
}

export const ExpansionScript = {
  // Remembers who owns every room we can see, so routes avoid other players' bases
  recordRoomOwners() {
    Memory.roomOwners ??= {};
    for (const room of Object.values(Game.rooms)) {
      const owner = room.controller?.owner?.username;
      if (owner) {
        Memory.roomOwners[room.name] = owner;
      } else if (room.controller) {
        delete Memory.roomOwners[room.name];
      }
    }
  },
  update() {
    ExpansionScript.recordRoomOwners();
    ScoutScript.importIntel();
    ScoutScript.recordIntel();
    if (!claimTarget() && Game.time % CHOOSE_INTERVAL === 0) {
      ExpansionScript.chooseClaim();
    }
    const pos = claimTarget();
    const owner = pos && Memory.roomOwners?.[pos.roomName];
    const sealed = pos && Memory.intel?.[pos.roomName]?.sealed;
    if (pos && ((owner && owner !== myUsername()) || sealed)) {
      const reason = sealed ? "controller walled off" : `taken by ${owner}`;
      console.log(`[${Game.time}] ${pos.roomName} 🚩 ${reason}, expansion cancelled`);
      Game.flags[CLAIM_FLAG]?.remove();
      delete Memory.claim;
      for (const creep of Object.values(Game.creeps).filter(c => c.memory.target === pos.roomName)) {
        delete creep.memory.target;
        delete creep.memory.nextRoom;
        delete creep.memory.routeFrom;
        if (creep.memory.role === "pioneer") {
          creep.memory.role = "builder";
          creep.memory.room = Game.getObjectById(creep.memory.spawnId)?.room.name ?? creep.room.name;
        } else {
          creep.suicide();
        }
      }
      return;
    }
    const room = pos && Game.rooms[pos.roomName];
    if (!pos || !room?.controller?.my) {
      return;
    }
    if (room.find(FIND_MY_SPAWNS).length > 0) {
      console.log(`[${Game.time}] ${room.name} 🚩 first spawn built, expansion done`);
      Game.flags[CLAIM_FLAG]?.remove();
      delete Memory.claim;
      return;
    }
    if (Memory.claim && !Memory.claim.claimed) {
      Memory.claim.claimed = true;
      console.log(`[${Game.time}] ${room.name} 🚩 controller claimed, pioneers building the spawn`);
    }
    // Leftovers of a previous owner (ramparts block creeps, anything on the spawn tile blocks the site)
    for (const structure of [...room.find(FIND_HOSTILE_STRUCTURES), ...pos.lookFor(LOOK_STRUCTURES)]) {
      structure.destroy();
    }
    const hasSite = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_SPAWN } }).length > 0;
    if (!hasSite) {
      pos.createConstructionSite(STRUCTURE_SPAWN, `${room.name}-1`);
    }
  },
  // Once the area around the expansion rooms is scouted, the best room becomes the claim target
  chooseClaim() {
    const homes = expansionHomes();
    if (
      homes.length === 0 ||
      !canClaimMore() ||
      Game.cpu.bucket < CHOOSE_MIN_BUCKET ||
      homes.some(home => ScoutScript.needsScouting(home))
    ) {
      return;
    }
    const best = ScoutScript.chooseTarget(homes);
    if (best && Memory.intel?.[best.room]?.sealed === undefined) {
      console.log(
        `[${Game.time}] ${best.room} 👁 best candidate, sending a scout to check its controller is reachable`
      );
      Memory.scoutTarget = best.room;
      return;
    }
    if (best) {
      console.log(
        `[${Game.time}] ${best.room} 🚩 chosen as next colony (score ${Math.round(best.score)}, spawn ${best.x},${best.y})`
      );
      Memory.claim = { room: best.room, x: best.x, y: best.y };
    }
  },
  // Spawns the next scout/claimer/pioneer; returns true if it used the spawn
  spawnCreeps(spawn: StructureSpawn, staticName: string): boolean {
    const pos = claimTarget();
    if (!pos) {
      return ExpansionScript.spawnScout(spawn, staticName);
    }
    const target = pos.roomName;
    const homes = expansionHomes(target);
    if (!homes.includes(spawn.room.name)) {
      return false;
    }
    const targetRoom = Game.rooms[target];
    if (targetRoom && targetRoom.find(FIND_MY_SPAWNS).length > 0) {
      return false;
    }
    const team = Object.values(Game.creeps).filter(creep => creep.memory.target === target);
    const claimed = targetRoom?.controller?.my ?? false;
    const memory = { working: false, spawnId: spawn.id, room: target, target };

    if (!claimed && !team.some(creep => creep.memory.role === "claimer")) {
      if (!canClaimMore() || spawnedNow("claimer") > 0) {
        return false;
      }
      // The claimer only lives 600 ticks: it comes from the closest expansion room
      const closest = [...homes].sort((a, b) => routeLength(a, target) - routeLength(b, target))[0];
      if (closest !== spawn.room.name) {
        return false;
      }
      if (spawn.room.energyAvailable < bodyCost(CLAIMER_BODY)) {
        return true;
      }
      const name = `${staticName}🚩${Game.time}`;
      if (spawnExpansionCreep(spawn, CLAIMER_BODY, name, { ...memory, role: "claimer" }) === OK && Memory.claim) {
        // A second claimer means the previous one died before claiming
        Memory.claim.claimers = (Memory.claim.claimers ?? 0) + 1;
        const attempt = Memory.claim.claimers > 1 ? ` (attempt ${Memory.claim.claimers}, previous claimer lost)` : "";
        console.log(`[${Game.time}] ${target} 🚩 claimer sent from ${spawn.room.name}${attempt}`);
      }
      return true;
    }
    if (team.filter(creep => creep.memory.role === "pioneer").length + spawnedNow("pioneer") < PIONEERS) {
      const count = Math.min(
        PIONEER_MAX_PATTERNS,
        Math.floor(spawn.room.energyCapacityAvailable / bodyCost(PIONEER_PATTERN))
      );
      if (spawn.room.energyAvailable < count * bodyCost(PIONEER_PATTERN)) {
        return true;
      }
      const body = Array.from({ length: count }, () => PIONEER_PATTERN).flat();
      spawnExpansionCreep(spawn, body, `${staticName}🧭${Game.time}`, { ...memory, role: "pioneer" });
      return true;
    }
    return false;
  },
  // Each expansion room scouts its own surroundings
  spawnScout(spawn: StructureSpawn, staticName: string): boolean {
    const home = spawn.room.name;
    if (
      !canClaimMore() ||
      !expansionHomes().includes(home) ||
      Object.values(Game.creeps).some(creep => creep.memory.role === "scout" && creep.memory.room === home) ||
      !ScoutScript.needsScouting(home)
    ) {
      return false;
    }
    spawn.spawnCreep([MOVE], `${staticName}👁${Game.time}`, {
      memory: { role: "scout", working: false, spawnId: spawn.id, room: home }
    });
    return true;
  },
  // Moves one room at a time along a safe route; returns false once the creep is inside the target room
  travelTo(creep: Creep, roomName: string): boolean {
    const { x, y } = creep.pos;
    if (creep.room.name === roomName) {
      if (x === 0 || x === 49 || y === 0 || y === 49) {
        creep.moveTo(new RoomPosition(25, 25, roomName), { range: 20 });
        return true;
      }
      return false;
    }
    if (creep.memory.routeFrom !== creep.room.name || !creep.memory.nextRoom) {
      const route = Game.map.findRoute(creep.room.name, roomName, { routeCallback: routeCost });
      if (route === ERR_NO_PATH || route.length === 0) {
        delete creep.memory.nextRoom;
        creep.say("no route");
        CreepScript.park(creep);
        return true;
      }
      creep.memory.routeFrom = creep.room.name;
      creep.memory.nextRoom = route[0].room;
    }
    // Range 23 from the centre is reached one step inside the next room, then the next leg is planned
    creep.moveTo(new RoomPosition(25, 25, creep.memory.nextRoom), {
      range: 23,
      maxRooms: 2,
      reusePath: 50,
      visualizePathStyle: { stroke: "#ff00ff" }
    });
    return true;
  }
};
