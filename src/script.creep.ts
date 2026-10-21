import { LINK_SEND_THRESHOLD, SystemScript } from "script.system";
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

// Scripts related with creeps
export const CreepScript = {
  spawnHarvester(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    const sources = spawn.room.find(FIND_SOURCES);
    const assignedBySource = new Map<Id<Source>, number>();
    for (const creep of Object.values(Game.creeps)) {
      if (creep.memory.spawnId === spawn.id && creep.memory.role === "harvester" && creep.memory.sourceId) {
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
      memory: { role: "harvester", working: false, sourceId: source.id, spawnId: spawn.id }
    });
  },

  spawnMiner(spawn: StructureSpawn, saticName: string, sources: Source[]) {
    const energyAvailable = Math.min(spawn.room.energyAvailable, MINER_MAX_COST);
    spawn.memory.nextMinerSpawnSource =
      spawn.memory.nextMinerSpawnSource !== undefined && spawn.memory.nextMinerSpawnSource !== null
        ? (spawn.memory.nextMinerSpawnSource + 1) % sources.length
        : 0;
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
        sourceId: sources[spawn.memory.nextMinerSpawnSource].id,
        spawnId: spawn.id
      }
    });
  },
  spawnGrabber(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([CARRY, MOVE], Math.floor(energyAvailable / 100));
    } else {
      bodyParts = repeatBody([CARRY, CARRY, MOVE], Math.floor(energyAvailable / 150));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🤲${Game.time}`, {
      memory: { role: "grabber", working: false, spawnId: spawn.id }
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
      memory: { role: "upgrader", working: false, spawnId: spawn.id }
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
      memory: { role: "builder", working: false, spawnId: spawn.id }
    });
  },
  spawnCreeps(spawn: StructureSpawn, saticName: string) {
    if (spawn.spawning !== null) {
      return;
    }

    const sources = spawn.room.find(FIND_SOURCES);
    if (sources.length === 0) {
      return;
    }
    const energyAvailable = spawn.room.energyAvailable;
    const creepsByRole = _.groupBy(
      Object.values(Game.creeps).filter(creep => creep.memory.spawnId === spawn.id),
      creep => creep.memory.role
    );

    const harvesters = creepsByRole.harvester || [];
    const miners = creepsByRole.miner || [];
    const grabbers = creepsByRole.grabber || [];
    const upgraders = creepsByRole.upgrader || [];
    const builders = creepsByRole.builder || [];

    // Let an adjacent creep renew instead of starting a new spawn
    const renewingHere = Object.values(Game.creeps).some(
      creep => creep.memory.renewing && creep.memory.spawnId === spawn.id && creep.pos.isNearTo(spawn)
    );
    if (renewingHere) {
      return;
    }

    const isConstructionSite = spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0;
    const contrlLvl = spawn.room.controller?.level ?? 0;
    const capacity = spawn.room.energyCapacityAvailable;
    // Economy collapsed: nobody can refill extensions, so spawn with what we have
    const emergency = harvesters.length === 0 && (miners.length === 0 || grabbers.length === 0);
    const ready = (minCost: number, role: string) =>
      energyAvailable >= minCost && (emergency || energyAvailable >= Math.min(capacity, roleMaxCost(role, spawn.room)));

    const needsHarvester = (miners.length === 0 || grabbers.length === 0) && harvesters.length < 2;
    const needsMiner =
      miners.length <= grabbers.length &&
      ((contrlLvl <= 4 && miners.length < 3) || (contrlLvl >= 5 && miners.length < 2));
    const grabberLimit = contrlLvl <= 3 ? 3 : 2;
    // Emergency grabbers are tiny: allow one extra so a full-size one can replace it
    const fullGrabbers = grabbers.filter(creep => isFullSize(creep, spawn.room)).length;
    const needsGrabber =
      grabbers.length < grabberLimit || (fullGrabbers < grabberLimit && grabbers.length <= grabberLimit);
    const needsUpgrader =
      (contrlLvl === 1 && upgraders.length < 8) ||
      (contrlLvl <= 3 && ((!isConstructionSite && upgraders.length < 6) || upgraders.length < 3)) ||
      (contrlLvl === 4 && upgraders.length < 2) ||
      (contrlLvl >= 5 && upgraders.length < 1);
    const needsBuilder =
      isConstructionSite &&
      ((contrlLvl <= 3 && builders.length < 3) ||
        (contrlLvl <= 4 && builders.length < 2) ||
        (contrlLvl >= 5 && builders.length < 1));

    if (needsHarvester) {
      if (ready(250, "harvester")) CreepScript.spawnHarvester(spawn, saticName);
    } else if (needsMiner) {
      if (ready(contrlLvl >= 5 ? 300 : 250, "miner")) CreepScript.spawnMiner(spawn, saticName, sources);
    } else if (needsGrabber) {
      // No full-size grabber yet: a medium helper now beats waiting on a lone weak one to fill extensions
      const rush = fullGrabbers === 0 && grabbers.length < grabberLimit && energyAvailable >= MAX_COST.grabber / 4;
      if (rush || ready(100, "grabber")) CreepScript.spawnGrabber(spawn, saticName);
    } else if (needsBuilder) {
      if (ready(250, "builder")) CreepScript.spawnBuilder(spawn, saticName);
    } else if (needsUpgrader) {
      if (ready(250, "upgrader")) CreepScript.spawnUpgrader(spawn, saticName);
    }
  },
  // Returns true while the creep is busy renewing (skip its role logic)
  renew(creep: Creep): boolean {
    const spawn = Game.getObjectById(creep.memory.spawnId);
    const ttl = creep.ticksToLive ?? CREEP_LIFE_TIME;
    if (!spawn) {
      creep.memory.renewing = false;
      return false;
    }
    if (!creep.memory.renewing) {
      const storageEnergy = spawn.room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
      // Only renew creeps at least as good as what we would spawn today
      // Pre-RCL5 miners lack CARRY and can't feed source links
      const outdatedMiner =
        creep.memory.role === "miner" &&
        (spawn.room.controller?.level ?? 0) >= 5 &&
        creep.getActiveBodyparts(CARRY) === 0;
      // Carry-heavy upgraders are replaced by WORK-heavy ones once the controller link exists
      const outdatedUpgrader =
        creep.memory.role === "upgrader" &&
        SystemScript.getLinks(spawn.room).controller !== undefined &&
        creep.getActiveBodyparts(CARRY) > LINK_UPGRADER_CARRY;
      const worthIt = !outdatedMiner && !outdatedUpgrader && isFullSize(creep, spawn.room);
      if (ttl > RENEW_START_TTL || storageEnergy < RENEW_MIN_STORAGE || !worthIt) {
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
      ? new RoomPosition(spawn.pos.x - 10, spawn.pos.y + 10, spawn.pos.roomName)
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
    if (!emptyingStructure) {
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
