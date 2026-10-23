import { LINK_SEND_THRESHOLD, SystemScript, hasEnergySurplus, homeRoomName } from "script.system";
import _ from "lodash";

function repeatBody(pattern: BodyPartConstant[], count: number): BodyPartConstant[] {
  const n = Math.min(count, Math.floor(MAX_CREEP_SIZE / pattern.length));
  return Array.from({ length: n }, () => pattern).flat();
}

const RENEW_START_TTL = 150;
const RENEW_STOP_TTL = 1300;
const RENEW_MIN_STORAGE = 10000;
// Miners gain nothing past 6 WORK (source regen cap)
const MINER_MAX_COST = 800;
// Cost of the largest body each role can spawn
const MAX_COST: Record<string, number> = {
  miner: MINER_MAX_COST,
  grabber: 2400,
  harvester: 3000,
  upgrader: 3200,
  builder: 3200
};

function bodyCost(body: BodyPartDefinition[]): number {
  return body.reduce((sum, part) => sum + BODYPART_COST[part.type], 0);
}

const LINK_UPGRADER_CARRY = 4;

function linkUpgraderCost(work: number): number {
  return (
    LINK_UPGRADER_CARRY * BODYPART_COST[CARRY] + work * BODYPART_COST[WORK] + Math.ceil(work / 4) * BODYPART_COST[MOVE]
  );
}

// Link-fed upgraders stand still: max WORK, small CARRY buffer, 1 MOVE per 4 WORK
function linkUpgraderBody(energy: number, maxWork: number): BodyPartConstant[] {
  for (let work = maxWork; work > 0; work--) {
    const move = Math.ceil(work / 4);
    if (linkUpgraderCost(work) <= energy && LINK_UPGRADER_CARRY + work + move <= MAX_CREEP_SIZE) {
      return [
        ...Array<BodyPartConstant>(work).fill(WORK),
        ...Array<BodyPartConstant>(LINK_UPGRADER_CARRY).fill(CARRY),
        ...Array<BodyPartConstant>(move).fill(MOVE)
      ];
    }
  }
  return [];
}

// RCL 8 caps upgrading at 15 energy/tick, so bigger upgraders are wasted
function maxUpgradeWork(room: Room): number {
  return room.controller?.level === 8 ? CONTROLLER_MAX_UPGRADE_PER_TICK : MAX_CREEP_SIZE;
}

function roleMaxCost(role: string, room: Room): number {
  if (role === "upgrader" && room.controller?.level === 8) {
    return linkUpgraderCost(CONTROLLER_MAX_UPGRADE_PER_TICK);
  }
  return MAX_COST[role] ?? Infinity;
}

function isFullSize(creep: Creep, room: Room): boolean {
  return bodyCost(creep.body) >= Math.min(room.energyCapacityAvailable, roleMaxCost(creep.memory.role, room)) * 0.9;
}

function roleLimits(level: number, construction: boolean, needsHarvesters: boolean): Record<string, number> {
  return {
    harvester: needsHarvesters ? 2 : 0,
    grabber: level <= 3 ? 3 : level <= 7 ? 2 : 1,
    upgrader: level === 1 ? 8 : level <= 3 ? (construction ? 3 : 6) : level === 4 ? 2 : 1,
    builder: !construction ? 0 : level <= 3 ? 3 : level === 4 ? 2 : 1
  };
}

interface GrabberPlan {
  limit: number;
  assignments: Map<string, Source>;
}

const grabberPlans = new Map<string, { tick: number; plan: GrabberPlan }>();
const haulingPaths = new Map<string, { tick: number; path: PathStep[] }>();

export function getGrabberPlan(room: Room): GrabberPlan {
  const cached = grabberPlans.get(room.name);
  if (cached?.tick === Game.time) {
    return cached.plan;
  }
  const level = room.controller?.level ?? 0;
  const baseline = roleLimits(level, false, false).grabber;
  const plan: GrabberPlan = { limit: baseline, assignments: new Map() };
  const depot =
    room.storage ?? room.find(FIND_MY_SPAWNS).sort((first, second) => first.name.localeCompare(second.name))[0];
  if (!depot) {
    return plan;
  }
  const creeps = Object.values(Game.creeps).filter(creep => homeRoomName(creep) === room.name);
  const miners = creeps.filter(creep => creep.memory.role === "miner");
  const grabbers = creeps.filter(creep => creep.memory.role === "grabber");
  const energy = Math.min(room.energyCapacityAvailable, MAX_COST.grabber);
  const carryParts = energy < 1800 ? Math.floor(energy / 100) : Math.floor(energy / 150) * 2;
  const capacity = Math.max(CARRY_CAPACITY, carryParts * CARRY_CAPACITY);
  const terrain = room.getTerrain();
  const roads = new Set(
    room
      .find(FIND_STRUCTURES)
      .filter(structure => structure.structureType === STRUCTURE_ROAD)
      .map(road => road.pos.y * 50 + road.pos.x)
  );
  const links = SystemScript.getLinks(room).sources;
  const routes = room.find(FIND_SOURCES).flatMap(source => {
    const sourceMiners = miners.filter(miner => miner.memory.sourceId === source.id);
    if (
      links.some(link => link.pos.inRangeTo(source, 2)) &&
      sourceMiners.some(miner => miner.getActiveBodyparts(CARRY) > 0)
    ) {
      return [];
    }
    const key = `${room.name}:${depot.id}:${source.id}`;
    let cachedPath = haulingPaths.get(key);
    if (!cachedPath || Game.time - cachedPath.tick >= 100) {
      cachedPath = { tick: Game.time, path: room.findPath(depot.pos, source.pos, { range: 1, ignoreCreeps: true }) };
      haulingPaths.set(key, cachedPath);
    }
    if (cachedPath.path.length === 0 && !depot.pos.isNearTo(source)) {
      return [];
    }
    const loadedWeight = energy < 1800 ? 1 : 2;
    const roundTrip = cachedPath.path.reduce((ticks, step) => {
      const road = roads.has(step.y * 50 + step.x);
      const swamp = terrain.get(step.x, step.y) === TERRAIN_MASK_SWAMP;
      return ticks + 1 + (road ? 1 : loadedWeight * (swamp ? 5 : 1));
    }, 4);
    const production = source.energyCapacity / ENERGY_REGEN_TIME;
    const work = sourceMiners.reduce((total, miner) => total + miner.getActiveBodyparts(WORK), 0);
    const rate = sourceMiners.length > 0 ? Math.min(production, work * HARVEST_POWER) : production;
    return [{ source, required: rate * roundTrip * 1.1, assigned: 0 }];
  });
  plan.limit = Math.max(
    baseline,
    routes.reduce((total, route) => total + Math.ceil(route.required / capacity), 0)
  );
  const ordered = grabbers.sort((first, second) => first.name.localeCompare(second.name));
  for (const grabber of ordered) {
    const route = routes.find(
      candidate => candidate.source.id === grabber.memory.sourceId && candidate.assigned < candidate.required
    );
    if (route) {
      route.assigned += grabber.store.getCapacity(RESOURCE_ENERGY);
      plan.assignments.set(grabber.name, route.source);
    }
  }
  for (const grabber of ordered) {
    if (plan.assignments.has(grabber.name)) {
      continue;
    }
    const route = routes.reduce<(typeof routes)[number] | undefined>(
      (best, candidate) =>
        !best || candidate.required - candidate.assigned > best.required - best.assigned ? candidate : best,
      undefined
    );
    if (route) {
      route.assigned += grabber.store.getCapacity(RESOURCE_ENERGY);
      plan.assignments.set(grabber.name, route.source);
      grabber.memory.sourceId = route.source.id;
    } else {
      delete grabber.memory.sourceId;
    }
  }
  grabberPlans.set(room.name, { tick: Game.time, plan });
  return plan;
}

// True once a replacement spawned now would reach the source just as this miner dies
function isMinerExpiring(miner: Creep, spawn: StructureSpawn): boolean {
  if (miner.spawning || miner.ticksToLive === undefined) {
    return false;
  }
  const source = miner.memory.sourceId ? Game.getObjectById(miner.memory.sourceId) : null;
  // Paths are longer than the straight range
  const travel = source ? Math.ceil(spawn.pos.getRangeTo(source) * 1.5) : 0;
  return miner.ticksToLive <= miner.body.length * CREEP_SPAWN_TIME + travel;
}

// Scripts related with creeps
export const CreepScript = {
  spawnHarvester(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    const sources = spawn.room.find(FIND_SOURCES);
    const assignedBySource = new Map<Id<Source>, number>();
    for (const creep of Object.values(Game.creeps)) {
      if (homeRoomName(creep) === spawn.room.name && creep.memory.role === "harvester" && creep.memory.sourceId) {
        assignedBySource.set(creep.memory.sourceId, (assignedBySource.get(creep.memory.sourceId) ?? 0) + 1);
      }
    }
    const source = sources.reduce((leastAssigned, candidate) => {
      const assigned = assignedBySource.get(candidate.id) ?? 0;
      const leastAssignedCount = assignedBySource.get(leastAssigned.id) ?? 0;
      return assigned < leastAssignedCount ? candidate : leastAssigned;
    }, sources[0]);
    const bodyParts = repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250));
    spawn.spawnCreep(bodyParts, `${saticName}☄${Game.time}`, {
      memory: { role: "harvester", working: false, sourceId: source.id, spawnId: spawn.id, room: spawn.room.name }
    });
  },

  spawnMiner(spawn: StructureSpawn, saticName: string, source: Source) {
    const energyAvailable = Math.min(spawn.room.energyAvailable, MINER_MAX_COST);
    // One CARRY lets miners feed source links (built from RCL 5)
    const withCarry = (spawn.room.controller?.level ?? 0) >= 5;
    const bodyParts: BodyPartConstant[] = [
      ...(withCarry ? [CARRY] : []),
      ...repeatBody([WORK, WORK, MOVE], Math.floor((energyAvailable - (withCarry ? 50 : 0)) / 250))
    ];
    spawn.spawnCreep(bodyParts, `${saticName}⛏${Game.time}`, {
      memory: {
        role: "miner",
        working: false,
        sourceId: source.id,
        spawnId: spawn.id,
        room: spawn.room.name
      }
    });
  },
  spawnGrabber(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = Math.min(spawn.room.energyAvailable, MAX_COST.grabber);
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([CARRY, MOVE], Math.floor(energyAvailable / 100));
    } else {
      bodyParts = repeatBody([CARRY, CARRY, MOVE], Math.floor(energyAvailable / 150));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🤲${Game.time}`, {
      memory: { role: "grabber", working: false, spawnId: spawn.id, room: spawn.room.name }
    });
  },
  spawnUpgrader(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = Math.min(spawn.room.energyAvailable, roleMaxCost("upgrader", spawn.room));
    let bodyParts: BodyPartConstant[] = [];
    if (SystemScript.getLinks(spawn.room).controller) {
      bodyParts = linkUpgraderBody(energyAvailable, maxUpgradeWork(spawn.room));
    }
    if (bodyParts.length === 0) {
      bodyParts =
        energyAvailable < 1800
          ? repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250))
          : repeatBody([WORK, CARRY, MOVE], Math.floor(energyAvailable / 200));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🛠${Game.time}`, {
      memory: { role: "upgrader", working: false, spawnId: spawn.id, room: spawn.room.name }
    });
  },

  spawnBuilder(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250));
    } else {
      bodyParts = repeatBody([WORK, CARRY, MOVE], Math.floor(energyAvailable / 200));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🏗${Game.time}`, {
      memory: { role: "builder", working: false, spawnId: spawn.id, room: spawn.room.name }
    });
  },
  spawnCreeps(spawn: StructureSpawn, saticName: string): boolean {
    if (spawn.spawning !== null) {
      return false;
    }

    const sources = spawn.room.find(FIND_SOURCES);
    if (sources.length === 0) {
      return false;
    }
    const energyAvailable = spawn.room.energyAvailable;
    const creepsByRole = _.groupBy(
      Object.values(Game.creeps).filter(creep => homeRoomName(creep) === spawn.room.name),
      creep => creep.memory.role
    );

    const harvesters = creepsByRole.harvester || [];
    const miners = creepsByRole.miner || [];
    const grabbers = creepsByRole.grabber || [];
    const upgraders = creepsByRole.upgrader || [];
    const builders = creepsByRole.builder || [];

    const isConstructionSite = spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0;
    const contrlLvl = spawn.room.controller?.level ?? 0;
    const capacity = spawn.room.energyCapacityAvailable;
    // Economy collapsed: nobody can refill extensions, so spawn with what we have
    const emergency = harvesters.length === 0 && (miners.length === 0 || grabbers.length === 0);
    const ready = (minCost: number, role: string) =>
      energyAvailable >= minCost && (emergency || energyAvailable >= Math.min(capacity, roleMaxCost(role, spawn.room)));

    const limits = roleLimits(contrlLvl, isConstructionSite, miners.length === 0 || grabbers.length === 0);
    const needsHarvester = harvesters.length < limits.harvester;
    // Expiring miners don't count, so their replacement spawns before they die
    const activeMiners = miners.filter(creep => !isMinerExpiring(creep, spawn));
    const needsMiner =
      activeMiners.length <= grabbers.length &&
      ((contrlLvl <= 4 && activeMiners.length < 3) || (contrlLvl >= 5 && activeMiners.length < 2));
    const grabberLimit = getGrabberPlan(spawn.room).limit;
    // Emergency grabbers are tiny: allow one extra so a full-size one can replace it
    const fullGrabbers = grabbers.filter(creep => isFullSize(creep, spawn.room)).length;
    const needsGrabber =
      !grabbers.some(creep => creep.spawning) &&
      (grabbers.length < grabberLimit || (fullGrabbers < grabberLimit && grabbers.length <= grabberLimit));
    const needsUpgrader = upgraders.length < limits.upgrader;
    const needsBuilder = builders.length < limits.builder;

    if (needsHarvester) {
      if (ready(250, "harvester")) CreepScript.spawnHarvester(spawn, saticName);
    } else if (needsMiner) {
      if (ready(contrlLvl >= 5 ? 300 : 250, "miner")) {
        const minersBySource = _.countBy(activeMiners, creep => creep.memory.sourceId);
        const source = sources.reduce((least, candidate) =>
          (minersBySource[candidate.id] ?? 0) < (minersBySource[least.id] ?? 0) ? candidate : least
        );
        CreepScript.spawnMiner(spawn, saticName, source);
      }
    } else if (needsGrabber) {
      // No full-size grabber yet: a medium helper now beats waiting on a lone weak one to fill extensions
      const rush = fullGrabbers === 0 && grabbers.length < grabberLimit && energyAvailable >= MAX_COST.grabber / 4;
      if (rush || ready(100, "grabber")) CreepScript.spawnGrabber(spawn, saticName);
    } else if (needsBuilder) {
      if (ready(250, "builder")) CreepScript.spawnBuilder(spawn, saticName);
    } else if (needsUpgrader) {
      if (ready(250, "upgrader")) CreepScript.spawnUpgrader(spawn, saticName);
    } else {
      return true;
    }
    return false;
  },
  isRenewingAt(spawn: StructureSpawn): boolean {
    return spawn.pos.findInRange(FIND_MY_CREEPS, 1, { filter: creep => creep.memory.renewing }).length > 0;
  },
  // Returns true while the creep is busy renewing (skip its role logic)
  renew(creep: Creep): boolean {
    // Miners are replaced ahead of time instead: renewing costs as much and leaves the source unworked
    if (creep.memory.role === "miner") {
      creep.memory.renewing = false;
      return false;
    }
    const ttl = creep.ticksToLive ?? CREEP_LIFE_TIME;
    if (!creep.memory.renewing && ttl > RENEW_START_TTL) {
      return false;
    }
    const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS) ?? Game.getObjectById(creep.memory.spawnId);
    if (!spawn) {
      creep.memory.renewing = false;
      return false;
    }
    const home = homeRoomName(creep);
    const room = Game.rooms[home] ?? spawn.room;
    const roomCreeps = Object.values(Game.creeps).filter(candidate => homeRoomName(candidate) === home);
    const limits = roleLimits(
      room.controller?.level ?? 0,
      room.find(FIND_CONSTRUCTION_SITES).length > 0,
      !roomCreeps.some(candidate => candidate.memory.role === "miner") ||
        !roomCreeps.some(candidate => candidate.memory.role === "grabber")
    );
    const limit = creep.memory.role === "grabber" ? getGrabberPlan(room).limit : limits[creep.memory.role];
    if (limit !== undefined) {
      const retained = roomCreeps
        .filter(candidate => candidate.memory.role === creep.memory.role)
        .sort(
          (first, second) =>
            bodyCost(second.body) - bodyCost(first.body) ||
            (second.ticksToLive ?? CREEP_LIFE_TIME) - (first.ticksToLive ?? CREEP_LIFE_TIME) ||
            first.name.localeCompare(second.name)
        )
        .slice(0, limit);
      if (!retained.includes(creep)) {
        creep.memory.renewing = false;
        return false;
      }
    }
    if (!creep.memory.renewing) {
      const storageEnergy = spawn.room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
      // Only renew creeps at least as good as what we would spawn today
      // Carry-heavy upgraders are replaced by WORK-heavy ones once the controller link exists
      const outdatedUpgrader =
        creep.memory.role === "upgrader" &&
        SystemScript.getLinks(spawn.room).controller !== undefined &&
        creep.getActiveBodyparts(CARRY) > LINK_UPGRADER_CARRY;
      // Idle builders are left to expire; a new one is spawned when sites appear
      const idleBuilder = creep.memory.role === "builder" && spawn.room.find(FIND_MY_CONSTRUCTION_SITES).length === 0;
      const worthIt = !outdatedUpgrader && !idleBuilder && isFullSize(creep, spawn.room);
      if (storageEnergy < RENEW_MIN_STORAGE || !worthIt) {
        return false;
      }
      creep.memory.renewing = true;
    }
    if (ttl >= RENEW_STOP_TTL) {
      creep.memory.renewing = false;
      return false;
    }
    if (!creep.pos.isNearTo(spawn)) {
      creep.moveTo(spawn, { visualizePathStyle: { stroke: "#00ff00" } });
      return true;
    }
    const result = spawn.renewCreep(creep);
    if (result === ERR_NOT_ENOUGH_ENERGY || result === ERR_FULL) {
      creep.memory.renewing = false;
      return false;
    }
    creep.say("♻️");
    return true;
  },
  doNotDisturb(creep: Creep) {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      creep.memory.working = true;
      return;
    }
    const spawn = Game.getObjectById(creep.memory.spawnId);
    const WaitPosition = spawn
      ? new RoomPosition(Math.max(1, spawn.pos.x - 10), Math.min(48, spawn.pos.y + 10), spawn.pos.roomName)
      : new RoomPosition(10, 10, creep.room.name);
    creep.moveTo(WaitPosition, { visualizePathStyle: { stroke: "#ffaa00" } });
    creep.say("Au coin! 😭");
  },
  findEnergy(creep: Creep) {
    // First, try to findthe closest storage
    const depots = creep.room.find(FIND_MY_STRUCTURES, {
      filter: structure => {
        return structure.structureType === STRUCTURE_STORAGE;
      }
    });

    // If no storage is found, try to find the closest spawn
    if (!depots || depots.length === 0) {
      const spawn = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_SPAWN && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50;
        }
      });
      if (!spawn) {
        CreepScript.doNotDisturb(creep);
      }
      if (spawn && creep.withdraw(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    const availableDepots = depots.filter(structure => structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50);

    const depot = creep.pos.findClosestByPath(availableDepots);

    if (!depot) {
      CreepScript.doNotDisturb(creep);
    }
    if (depot && creep.withdraw(depot, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(depot, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  },
  getEmptyingStructure(creep: Creep) {
    // Extension otherwiese tower otherwise spawn
    // First, try to find the closest extension
    let emptyingStructure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure => {
        return structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    // If no extension is found, try to find the closest spawn
    if (!emptyingStructure) {
      emptyingStructure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
    }

    // If no spawn is found, try to find the closest tower
    if (!emptyingStructure) {
      emptyingStructure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 250;
        }
      });
    }

    // Hub link forwards energy to the controller link
    if (!emptyingStructure && hasEnergySurplus(creep.room)) {
      const { hub, controller } = SystemScript.getLinks(creep.room);
      if (
        hub &&
        controller &&
        controller.store.getFreeCapacity(RESOURCE_ENERGY) >= LINK_SEND_THRESHOLD &&
        hub.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      ) {
        emptyingStructure = hub;
      }
    }

    // If no tower is found, try to find the closest storage
    if (!emptyingStructure) {
      emptyingStructure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
    }
    return emptyingStructure;
  }
};
