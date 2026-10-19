import { SystemScript } from "script.system";
import _ from "lodash";

function repeatBody(pattern: BodyPartConstant[], count: number): BodyPartConstant[] {
  const n = Math.min(count, Math.floor(MAX_CREEP_SIZE / pattern.length));
  return Array.from({ length: n }, () => pattern).flat();
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
    const energyAvailable = spawn.room.energyAvailable;
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
      bodyParts = repeatBody([CARRY, CARRY, MOVE], Math.floor((energyAvailable - 250) / 150));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🤲${Game.time}`, {
      memory: { role: "grabber", working: false, spawnId: spawn.id }
    });
  },
  spawnUpgrader(spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250));
    } else {
      bodyParts = repeatBody([WORK, CARRY, MOVE], Math.floor((energyAvailable - 50) / 200));
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
      bodyParts = repeatBody([WORK, CARRY, MOVE], Math.floor((energyAvailable - 50) / 200));
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
    SystemScript.printInfo(creepsByRole);

    const harvesters = creepsByRole.harvester || [];
    const miners = creepsByRole.miner || [];
    const grabbers = creepsByRole.grabber || [];
    const upgraders = creepsByRole.upgrader || [];
    const builders = creepsByRole.builder || [];

    const isConstructionSite = spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0;
    const contrlLvl = spawn.room.controller?.level ?? 0;

    const needsHarvester = (miners.length === 0 || grabbers.length === 0) && harvesters.length < 2;
    const needsMiner =
      miners.length <= grabbers.length &&
      ((contrlLvl <= 4 && miners.length < 3) || (contrlLvl >= 5 && miners.length < 2));
    const grabberLimit = contrlLvl <= 3 ? 3 : contrlLvl >= 5 ? 1 : 2;
    const needsGrabber = grabbers.length < grabberLimit;
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

    if (needsHarvester && energyAvailable >= 250) {
      CreepScript.spawnHarvester(spawn, saticName);
    } else if (needsMiner && energyAvailable >= (contrlLvl >= 5 ? 300 : 250)) {
      CreepScript.spawnMiner(spawn, saticName, sources);
    } else if (needsGrabber && energyAvailable >= 100) {
      CreepScript.spawnGrabber(spawn, saticName);
    } else if (needsBuilder && energyAvailable >= 250) {
      CreepScript.spawnBuilder(spawn, saticName);
    } else if (needsUpgrader && energyAvailable >= 250) {
      CreepScript.spawnUpgrader(spawn, saticName);
    }
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
      if (hub && controller && hub.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
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
