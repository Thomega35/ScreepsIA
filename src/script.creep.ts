import { SystemScript } from "script.system";
import _ from "lodash";

// Scripts related with creeps
export const CreepScript = {
  spawnHarvester: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    const bodyParts = SystemScript.flat(
      Array(Math.floor(energyAvailable / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
    ) as BodyPartConstant[];
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
    let bodyParts: BodyPartConstant[];
    bodyParts = SystemScript.flat(
      Array(Math.floor(energyAvailable / 250)).fill([WORK, WORK, MOVE]) as string[]
    ) as BodyPartConstant[];
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
      bodyParts = SystemScript.flat(
        Array(Math.floor(energyAvailable / 100)).fill([CARRY, MOVE]) as string[]
      ) as BodyPartConstant[];
    } else {
      bodyParts = SystemScript.flat(
        Array(Math.floor((energyAvailable - 250) / 150)).fill([CARRY, CARRY, MOVE]) as string[]
      );
    }
    spawn.spawnCreep(bodyParts, `${saticName}🤲${Game.time}`, {
      memory: { room: spawn.room, role: "grabber", working: false, spawn: spawn }
    });
  },
  spawnUpgrader: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = SystemScript.flat(
        Array(Math.floor(energyAvailable / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
      ) as BodyPartConstant[];
    } else {
      bodyParts = SystemScript.flat(Array(Math.floor((energyAvailable - 50) / 200)).fill([WORK, CARRY, MOVE]));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🛠${Game.time}`, {
      memory: { room: spawn.room, role: "upgrader", working: false, spawn: spawn }
    });
  },

  spawnBuilder: function (spawn: StructureSpawn, saticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    if (energyAvailable < 1800) {
      bodyParts = SystemScript.flat(
        Array(Math.floor(energyAvailable / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
      ) as BodyPartConstant[];
    } else {
      bodyParts = SystemScript.flat(Array(Math.floor((energyAvailable - 50) / 200)).fill([WORK, CARRY, MOVE]));
    }
    spawn.spawnCreep(bodyParts, `${saticName}🏗${Game.time}`, {
      memory: { room: spawn.room, role: "builder", working: false, spawn: spawn }
    });
  },
  spawnCreeps: function (spawn: StructureSpawn, saticName: string) {
    if (spawn.spawning) {
      // Log for busy spawn - kept simple as it's a common case.
      // console.log(`Spawn ${spawn.name}: No creep spawned - Spawn is busy.`); // Optional: can be too spammy
      return;
    }

    const sources = spawn.room.find(FIND_SOURCES);
    const energyAvailable = spawn.room.energyAvailable;
    const energyCapacity = spawn.room.energyCapacityAvailable;

    const allCreepsForSpawn = Object.values(Game.creeps).filter(c => c.memory.spawn?.id === spawn.id);
    const creepCountForSpawn = allCreepsForSpawn.length;
    const creepsByRole = _.groupBy(allCreepsForSpawn, c => c.memory.role);

    // SystemScript.printInfo(creepsByRole); // Original info log, can be kept or removed if new log is sufficient

    const harvesters = creepsByRole["harvester"] || [];
    const miners = creepsByRole["miner"] || [];
    const grabbers = creepsByRole["grabber"] || [];
    const upgraders = creepsByRole["upgrader"] || [];
    const builders = creepsByRole["builder"] || [];

    const isConstructionSite = spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0;
    const contrlLvl = spawn.room.controller?.level ?? 0;

    // Consolidated initial state log
    console.log(`Spawn ${spawn.name}: Energy: ${energyAvailable}/${energyCapacity}, Active Creeps: ${creepCountForSpawn}, RCL: ${contrlLvl}, Sites: ${isConstructionSite}, Counts: H${harvesters.length},M${miners.length},G${grabbers.length},U${upgraders.length},B${builders.length}`);

    let spawnedThisTick = false;
    let noSpawnReason = "";

    // Spawn Harvester logic
    const needMinersOrGrabbers = miners.length === 0 || grabbers.length === 0;
    const hasSufficientEnergyForHarvester = energyAvailable >= 300;
    const harvesterLimitNotReached = harvesters.length < 2;

    if (needMinersOrGrabbers && hasSufficientEnergyForHarvester && harvesterLimitNotReached) {
      console.log(`Spawn ${spawn.name}: Spawning Harvester (Need M/G: ${needMinersOrGrabbers}, Energy: ${hasSufficientEnergyForHarvester}, Limit: ${harvesterLimitNotReached}).`);
      CreepScript.spawnHarvester(spawn, saticName);
      spawnedThisTick = true;
    }
    // Main block for other roles, only if energy is at full capacity
    else if (energyAvailable === energyCapacity) {
      // Determine why harvester wasn't spawned if it's the case. This reason is only primary if no other creep is spawned.
      if (!spawnedThisTick) { // Only set if harvester didn't spawn
          if (!needMinersOrGrabbers) noSpawnReason = "Harvester skipped: Miner/Grabber counts sufficient.";
          else if (!hasSufficientEnergyForHarvester) noSpawnReason = `Harvester skipped: Insufficient energy (${energyAvailable} < 300).`;
          else if (!harvesterLimitNotReached) noSpawnReason = `Harvester skipped: Limit reached (${harvesters.length}/2).`;
          // This reason might be overridden if other roles are checked.
      }

      const minerConditionGrabber = miners.length <= grabbers.length;
      const minerConditionCount = (contrlLvl <= 4 && miners.length < 3) || (contrlLvl >= 5 && miners.length < 2);
      if (minerConditionGrabber && minerConditionCount) {
        console.log(`Spawn ${spawn.name}: Spawning Miner (M ${miners.length}<=G ${grabbers.length}, RCL ${contrlLvl} limit ok).`);
        CreepScript.spawnMiner(spawn, saticName, sources);
        spawnedThisTick = true;
      }
      else if ((contrlLvl <= 3 && grabbers.length < 3) || (contrlLvl >= 4 && grabbers.length < 2)) {
        console.log(`Spawn ${spawn.name}: Spawning Grabber (RCL ${contrlLvl} limit ok, Current: ${grabbers.length}).`);
        CreepScript.spawnGrabber(spawn, saticName);
        spawnedThisTick = true;
      }
      else if (
        (contrlLvl === 1 && upgraders.length < 8) ||
        (contrlLvl <= 3 && ((!isConstructionSite && upgraders.length < 6) || upgraders.length < 3)) ||
        (contrlLvl === 4 && upgraders.length < 2) ||
        (contrlLvl >= 5 && upgraders.length < 1)
      ) {
        console.log(`Spawn ${spawn.name}: Spawning Upgrader (RCL ${contrlLvl}, Sites: ${isConstructionSite}, Current: ${upgraders.length}).`);
        CreepScript.spawnUpgrader(spawn, saticName);
        spawnedThisTick = true;
      }
      else if (
        isConstructionSite &&
        ((contrlLvl <= 3 && builders.length < 3) ||
          (contrlLvl <= 4 && builders.length < 2) ||
          (contrlLvl >= 5 && builders.length < 1))
      ) {
        console.log(`Spawn ${spawn.name}: Spawning Builder (Sites: ${isConstructionSite}, RCL ${contrlLvl}, Current: ${builders.length}).`);
        CreepScript.spawnBuilder(spawn, saticName);
        spawnedThisTick = true;
      }
      else {
        if (!spawnedThisTick) { // Only if nothing has been spawned yet in this block
            noSpawnReason = "Energy full, but all role quotas met or conditions not right.";
            // More specific reason for builder failure if it was the last check
            if (!isConstructionSite) noSpawnReason += " (No construction sites for Builder).";
            else if (!(((contrlLvl <= 3 && builders.length < 3) || (contrlLvl <= 4 && builders.length < 2) || (contrlLvl >= 5 && builders.length < 1)))) noSpawnReason += ` (Builder limit for RCL ${contrlLvl} reached).`;
        }
      }
    }
    // Fallback: No harvester spawned, and energy is not full for other roles
    else {
      if (!spawnedThisTick) { // Only if harvester didn't spawn
        if (energyAvailable < energyCapacity) {
            noSpawnReason = `Insufficient energy for Harvester (${energyAvailable} < 300) or energy not full for other roles (${energyAvailable}/${energyCapacity}).`;
            if (!needMinersOrGrabbers) noSpawnReason = "Harvester not needed (Miner/Grabber counts ok) & energy not full for others.";
            else if (harvesterLimitNotReached && !hasSufficientEnergyForHarvester) noSpawnReason = `Harvester needs energy (${energyAvailable} < 300) & energy not full for others.`;
            else if (!harvesterLimitNotReached) noSpawnReason = `Harvester limit reached & energy not full for others.`;
        } else {
            // This case should ideally not be reached if logic is structured well,
            // as harvester conditions already checked.
            if (!needMinersOrGrabbers) noSpawnReason = "Harvester not needed (Miner/Grabber counts ok).";
            else if (!hasSufficientEnergyForHarvester) noSpawnReason = `Harvester needs energy (${energyAvailable} < 300).`;
            else if (!harvesterLimitNotReached) noSpawnReason = `Harvester limit reached.`;
            else noSpawnReason = "Harvester conditions not met (unknown reason).";
        }
      }
    }

    if (!spawnedThisTick && spawn.spawning === null) { // Check spawn.spawning again in case it changed during this tick by other means (unlikely in this structure)
        if (Object.keys(Game.spawns).length === 1 && Game.time < 1000 && creepCountForSpawn === 0) { // Very early game, no creeps yet
             console.log(`Spawn ${spawn.name}: No creep spawned. Reason: Early game, waiting for initial energy for Harvester.`);
        } else if (noSpawnReason) {
            console.log(`Spawn ${spawn.name}: No creep spawned. Reason: ${noSpawnReason}`);
        } else {
            // Default catch-all if noSpawnReason wasn't set, but should be.
            console.log(`Spawn ${spawn.name}: No creep spawned. Reason: All conditions checked, no suitable role found or resource constraints.`);
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
    // Log the idle status and reason
     // const roleName = creep.memory.role.charAt(0).toUpperCase() + creep.memory.role.slice(1); // Logic retained
     // console.log(`Creep ${creep.name} (${roleName}) is idle at ${creep.pos}. Reason: No suitable energy source found, moving to wait position.`); // LOG REMOVED
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
        return; // Ensure function exits if no spawn and doNotDisturb is called
      }
      // Attempt to withdraw from spawn
      if (spawn) { // Check if spawn is not null
        const amountAvailable = (spawn as StructureSpawn).store[RESOURCE_ENERGY];
        const withdrawResult = creep.withdraw(spawn, RESOURCE_ENERGY);
        if (withdrawResult === OK) {
          // We don't know the exact amount withdrawn without checking store before/after.
          // Log the amount that was available in the spawn, capped by creep's capacity if we want to be more precise.
          // For simplicity, let's log what was available or a generic success.
          // The request implies knowing the amount. Let's use amountAvailable from source.
           // const roleName = creep.memory.role.charAt(0).toUpperCase() + creep.memory.role.slice(1); // Logic retained
           // console.log(`${roleName} ${creep.name} withdrew ${amountAvailable} energy from ${spawn.id} (${spawn.structureType})`); // LOG REMOVED
        } else if (withdrawResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      }
      return;
    }

    const filterdepots = depots.filter(
      depot => (depot as StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > 50
    );

    const depot = creep.pos.findClosestByPath(filterdepots);

    if (!depot) {
      CreepScript.doNotDisturb(creep);
      return; // Ensure function exits if no depot and doNotDisturb is called
    }
    // Attempt to withdraw from depot
    if (depot) { // Check if depot is not null
        const amountAvailable = (depot as StructureStorage).store[RESOURCE_ENERGY];
        const withdrawResult = creep.withdraw(depot, RESOURCE_ENERGY);
        if (withdrawResult === OK) {
             // const roleName = creep.memory.role.charAt(0).toUpperCase() + creep.memory.role.slice(1); // Logic retained
             // console.log(`${roleName} ${creep.name} withdrew ${amountAvailable} energy from ${depot.id} (${depot.structureType})`); // LOG REMOVED
        } else if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(depot, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
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
