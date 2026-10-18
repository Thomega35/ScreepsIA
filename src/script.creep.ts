import { SystemScript } from "script.system";
import _ from "lodash";

function repeatBody(pattern: BodyPartConstant[], count: number): BodyPartConstant[] {
  const n = Math.min(count, Math.floor(MAX_CREEP_SIZE / pattern.length));
  return SystemScript.flat(Array(n).fill(pattern)) as BodyPartConstant[];
}

// Scripts related with creeps
export const CreepScript = {
  spawnHarvester: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    const bodyParts = repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250));
    spawn.spawnCreep(bodyParts, `${saticName}☄${Game.time}`, {
      memory: { room: spawn.room, role: "harvester", working: false, spawn: spawn }
    });
  },

  spawnMiner: function (spawn: StructureSpawn, saticName: string, sources: Source[]) {
    const energyAvailable = spawn.room.energyAvailable;
    spawn.memory.nextMinerSpawnSource =
      spawn.memory.nextMinerSpawnSource !== undefined && spawn.memory.nextMinerSpawnSource !== null
        ? (spawn.memory.nextMinerSpawnSource + 1) % sources.length
        : 0;
    const bodyParts = repeatBody([WORK, WORK, MOVE], Math.floor(energyAvailable / 250));
    spawn.spawnCreep(bodyParts, `${saticName}⛏${Game.time}`, {
      memory: {
        room: spawn.room,
        role: "miner",
        working: false,
        source: sources[spawn.memory.nextMinerSpawnSource],
        spawn: spawn
      }
    });
  },
  spawnGrabber: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([CARRY, MOVE], Math.floor(energyAvailable / 100));
    } else {
      bodyParts = repeatBody([CARRY, CARRY, MOVE], Math.floor((energyAvailable - 250) / 150));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🤲${Game.time}`, {
      memory: { room: spawn.room, role: "grabber", working: false, spawn: spawn }
    });
  },
  spawnUpgrader: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250));
    } else {
      bodyParts = repeatBody([WORK, CARRY, MOVE], Math.floor((energyAvailable - 50) / 200));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🛠${Game.time}`, {
      memory: { room: spawn.room, role: "upgrader", working: false, spawn: spawn }
    });
  },

  spawnBuilder: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = repeatBody([WORK, CARRY, MOVE, MOVE], Math.floor(energyAvailable / 250));
    } else {
      bodyParts = repeatBody([WORK, CARRY, MOVE], Math.floor((energyAvailable - 50) / 200));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🏗${Game.time}`, {
      memory: { room: spawn.room, role: "builder", working: false, spawn: spawn }
    });
  },
  spawnCreeps: function (spawn: StructureSpawn, saticName: string) {
    if (spawn.spawning !== null) {
      return;
    }

    const sources = spawn.room.find(FIND_SOURCES);
    const energyAvailable = spawn.room.energyAvailable;
    const energyCapacity = spawn.room.energyCapacityAvailable;
    const creepsByRole = _.groupBy(
      Object.values(Game.creeps).filter(creep => creep.memory.spawn?.id === spawn.id),
      creep => creep.memory.role
    );
    SystemScript.printInfo(creepsByRole);

    const harvesters = creepsByRole["harvester"] || [];
    const miners = creepsByRole["miner"] || [];
    const grabbers = creepsByRole["grabber"] || [];
    const upgraders = creepsByRole["upgrader"] || [];
    const builders = creepsByRole["builder"] || [];

    const isConstructionSite = spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0;
    const contrlLvl = spawn.room.controller?.level ?? 0;

    // Spawn Harvester
    if ((miners.length == 0 || grabbers.length == 0) && energyAvailable >= 300 && harvesters.length < 2) {
      CreepScript.spawnHarvester(spawn, saticName);
    } else if (energyAvailable === energyCapacity) {
      // Spawn Miner
      if (
        miners.length <= grabbers.length &&
        ((contrlLvl <= 4 && miners.length < 3) || (contrlLvl >= 5 && miners.length < 2))
      ) {
        CreepScript.spawnMiner(spawn, saticName, sources);
        // Spawn Grabber
      } else if ((contrlLvl <= 3 && grabbers.length < 3) || (contrlLvl >= 4 && grabbers.length < 2)) {
        CreepScript.spawnGrabber(spawn, saticName);
        // Spawn Upgrader
      } else if (
        (contrlLvl === 1 && upgraders.length < 8) ||
        (contrlLvl <= 3 && ((!isConstructionSite && upgraders.length < 6) || upgraders.length < 3)) ||
        (contrlLvl === 4 && upgraders.length < 2) ||
        (contrlLvl >= 5 && upgraders.length < 1)
      ) {
        CreepScript.spawnUpgrader(spawn, saticName);
      } else if (
        isConstructionSite &&
        ((contrlLvl <= 3 && builders.length < 3) ||
          (contrlLvl <= 4 && builders.length < 2) ||
          (contrlLvl >= 5 && builders.length < 1))
      ) {
        CreepScript.spawnBuilder(spawn, saticName);
      }
    }
  },
  doNotDisturb: function (creep: Creep) {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      creep.memory.working = true;
      return;
    }
    const spawn = Game.getObjectById(creep.memory.spawn?.id);
    const WaitPosition = spawn
      ? new RoomPosition(spawn.pos.x - 10, spawn.pos.y + 10, spawn.pos.roomName)
      : new RoomPosition(10, 10, creep.room.name);
    creep.moveTo(WaitPosition, { visualizePathStyle: { stroke: "#ffaa00" } });
    creep.say("Au coin! 😭");
  },
  findEnergy: function (creep: Creep) {
    // First, try to findthe closest storage
    const depots = creep.room.find(FIND_MY_STRUCTURES, {
      filter: structure => {
        return structure.structureType == STRUCTURE_STORAGE;
      }
    });

    // If no storage is found, try to find the closest spawn
    if (!depots || depots.length === 0) {
      const spawn = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: structure => {
          return structure.structureType == STRUCTURE_SPAWN && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50;
        }
      });
      if (!spawn) {
        CreepScript.doNotDisturb(creep);
      }
      if (spawn && creep.withdraw(spawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    const filterdepots = depots.filter(
      depot => (depot as StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > 50
    );

    const depot = creep.pos.findClosestByPath(filterdepots);

    if (!depot) {
      CreepScript.doNotDisturb(creep);
    }
    if (depot && creep.withdraw(depot, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(depot, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  },
  getEmptyingStructure: function (creep: Creep) {
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
