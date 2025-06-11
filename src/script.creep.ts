import { SystemScript } from "script.system";
import _ from "lodash";

// Scripts related with creeps
export const CreepScript = {
  /**
   * Generates a creep body array based on available energy and a repeating part segment.
   * @param {number} energyAvailable - The total energy available for spawning.
   * @param {BodyPartConstant[]} partSegment - The array of body parts to repeat (e.g., [WORK, CARRY, MOVE]).
   * @param {number} [maxSegments=10] - The maximum number of times the partSegment can be repeated.
   * @param {BodyPartConstant[]} [fixedPrefixParts=[]] - Optional parts to add at the beginning of the body.
   * @param {BodyPartConstant[]} [fixedSuffixParts=[]] - Optional parts to add at the end of the body.
   * @returns {BodyPartConstant[]} The generated body array, or an empty array if conditions aren't met.
   */
  generateBody: function (
    energyAvailable: number,
    partSegment: BodyPartConstant[],
    maxSegments: number = 10,
    fixedPrefixParts: BodyPartConstant[] = [],
    fixedSuffixParts: BodyPartConstant[] = []
  ): BodyPartConstant[] {
    const prefixCost = _.sum(fixedPrefixParts, part => BODYPART_COST[part]);
    const suffixCost = _.sum(fixedSuffixParts, part => BODYPART_COST[part]);
    const segmentCost = _.sum(partSegment, part => BODYPART_COST[part]);

    // Avoid issues if segment is all non-cost parts (e.g. TOUGH) or empty
    if (segmentCost === 0 && partSegment.length > 0) {
      console.log("Warning: generateBody called with zero-cost partSegment that is not empty.");
      // Fallback: just use prefix/suffix, or fill with segment up to max if segment itself is non-cost (e.g. TOUGH)
      // This case needs careful handling depending on desired behavior for zero-cost segments.
      // For now, let's assume it means "fill with this part as much as possible".
      let body: BodyPartConstant[] = [...fixedPrefixParts];
      const remainingEnergyForZeroCost = Math.max(0, energyAvailable - prefixCost - suffixCost);
      // This interpretation of zero-cost segment is to fill as many as possible up to maxSegments * segment.length
      const numZeroCostParts = Math.min(maxSegments * partSegment.length, Math.floor(remainingEnergyForZeroCost / 0)); // This is not right for 0 cost.
      // A better approach for zero-cost parts (like TOUGH) is to decide how many you want based on other criteria.
      // Given the current structure, if segmentCost is 0, numSegments will be Infinity if energyAvailable > 0.
      // Let's assume if segmentCost is 0, partSegment contains parts like TOUGH we want to fill.
      // Max parts is 50. Available parts after prefix/suffix.
      const availableSlots = 50 - fixedPrefixParts.length - fixedSuffixParts.length;
      const numPartsInSegment = partSegment.length;
      if (numPartsInSegment > 0) {
        const maxPossibleSegmentsOfZeroCost = Math.floor(availableSlots / numPartsInSegment);
        const actualNumSegments = Math.min(maxSegments, maxPossibleSegmentsOfZeroCost);
        for (let i = 0; i < actualNumSegments; i++) {
          body.push(...partSegment);
        }
      }
      body.push(...fixedSuffixParts);
      return body.slice(0, 50);
    }

    energyAvailable = Math.max(0, energyAvailable - prefixCost - suffixCost);

    let numSegments = 0;
    if (segmentCost > 0) {
        numSegments = Math.floor(energyAvailable / segmentCost);
    } else if (partSegment.length === 0) {
        numSegments = 0;
    }
    // If segmentCost is 0 and partSegment is not empty, it was handled above.

    numSegments = Math.min(numSegments, maxSegments);

    let body: BodyPartConstant[] = [...fixedPrefixParts];
    if (segmentCost > 0 || partSegment.length === 0 ) { // only iterate if segmentCost > 0 or it's an empty segment
        for (let i = 0; i < numSegments; i++) {
          body.push(...partSegment);
        }
    }
    body.push(...fixedSuffixParts);

    return body.slice(0, 50);
  },

  spawnHarvester: function (spawn: StructureSpawn, staticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    // Min body: [WORK, CARRY, MOVE] = 200
    if (energyAvailable < 200) {
        bodyParts = [];
    } else if (energyAvailable < 250) { // Basic harvester if not enough for first segment
        bodyParts = [WORK, CARRY, MOVE];
    } else {
        // Scalable segment: [WORK, CARRY, MOVE, MOVE] = 250. Max 8 such segments for ~2000 energy.
        bodyParts = this.generateBody(energyAvailable, [WORK, CARRY, MOVE, MOVE], 8);
    }

    if (bodyParts.length > 0) {
      spawn.spawnCreep(bodyParts, `${staticName}☄${Game.time}`, {
        memory: { room: spawn.room, role: "harvester", working: false, spawnId: spawn.id }
      });
    }
  },

  spawnMiner: function (spawn: StructureSpawn, staticName: string, sources: Source[]) {
    const energyAvailable = spawn.room.energyAvailable;
    // Cycle through sources for multiple miners
    spawn.memory.nextMinerSpawnSource =
      (spawn.memory.nextMinerSpawnSource !== undefined ? spawn.memory.nextMinerSpawnSource + 1 : 0) % sources.length;

    let bodyParts: BodyPartConstant[];
    // Min: [MOVE, WORK, WORK] = 250. Max 5 WORK parts.
    if (energyAvailable < 250) {
        bodyParts = [];
    } else {
        const workPartsCount = Math.min(Math.floor((energyAvailable - BODYPART_COST[MOVE]) / BODYPART_COST[WORK]), 5);
        if (workPartsCount < 2) {
            bodyParts = []; // Not enough for MOVE + 2 WORK
        } else {
            bodyParts = [MOVE]; // Single MOVE part
            for(let i = 0; i < workPartsCount; i++) {
                bodyParts.push(WORK);
            }
            // Optionally add a CARRY part if energy allows and it's desired for miners
            // if(energyAvailable >= _.sum(bodyParts, p => BODYPART_COST[p]) + BODYPART_COST[CARRY]) {
            //   bodyParts.push(CARRY);
            // }
        }
    }

    if (bodyParts.length > 0) {
      spawn.spawnCreep(bodyParts, `${staticName}⛏${Game.time}`, {
        memory: {
          room: spawn.room,
          role: "miner",
          working: false, // Miners are always "working" at their source
          sourceId: sources[spawn.memory.nextMinerSpawnSource].id,
          spawnId: spawn.id
        }
      });
    }
  },

  spawnGrabber: function (spawn: StructureSpawn, staticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    // Min: [CARRY, MOVE] = 100
    if (energyAvailable < 100) {
        bodyParts = [];
    } else {
        // Segment: [CARRY, MOVE] = 100. Max ~20 CARRY parts (so 20 segments for 40 parts total).
        bodyParts = this.generateBody(energyAvailable, [CARRY, MOVE], 20);
    }

    if (bodyParts.length > 0) {
      spawn.spawnCreep(bodyParts, `${staticName}🤲${Game.time}`, {
        memory: { room: spawn.room, role: "grabber", working: false, spawnId: spawn.id }
      });
    }
  },

  spawnUpgrader: function (spawn: StructureSpawn, staticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
    // Min: [WORK, CARRY, MOVE] = 200
    if (energyAvailable < 200) {
        bodyParts = [];
    } else {
        // Segment: [WORK, CARRY, MOVE] = 200. Upgraders can be large. Max 15 WORK parts (15 segments).
        bodyParts = this.generateBody(energyAvailable, [WORK, CARRY, MOVE], 15);
    }

    if (bodyParts.length > 0) {
      spawn.spawnCreep(bodyParts, `${staticName}🛠${Game.time}`, {
        memory: { room: spawn.room, role: "upgrader", working: false, spawnId: spawn.id }
      });
    }
  },

  spawnBuilder: function (spawn: StructureSpawn, staticName: string) {
    const energyAvailable = spawn.room.energyAvailable;
    let bodyParts: BodyPartConstant[];
     // Min: [WORK, CARRY, MOVE] = 200
    if (energyAvailable < 200) {
        bodyParts = [];
    } else {
       // Segment: [WORK, CARRY, MOVE] = 200. Max 10 WORK parts (10 segments).
        bodyParts = this.generateBody(energyAvailable, [WORK, CARRY, MOVE], 10);
    }

    if (bodyParts.length > 0) {
      spawn.spawnCreep(bodyParts, `${staticName}🏗${Game.time}`, {
        memory: { room: spawn.room, role: "builder", working: false, spawnId: spawn.id }
      });
    }
  },

  spawnCreeps: function (spawn: StructureSpawn, staticName: string) {
    if (spawn.spawning) { // Simplified check
      return;
    }

    const sources = spawn.room.find(FIND_SOURCES);
    const energyAvailable = spawn.room.energyAvailable;
    const energyCapacity = spawn.room.energyCapacityAvailable;

    // Filter creeps belonging to this spawn for role counting
    const creepsInRoom = Object.values(Game.creeps).filter(c => c.memory.spawnId === spawn.id || c.room.name === spawn.room.name);
    const creepsByRole = _.groupBy(creepsInRoom, c => c.memory.role);

    // Call printInfo with the spawn's room and these filtered creeps
    SystemScript.printInfo(spawn.room, creepsByRole);

    const harvesters = creepsByRole["harvester"] || [];
    const miners = creepsByRole["miner"] || [];
    const grabbers = creepsByRole["grabber"] || [];
    const upgraders = creepsByRole["upgrader"] || [];
    const builders = creepsByRole["builder"] || [];

    const isConstructionSite = spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0;
    const contrlLvl = spawn.room.controller?.level ?? 0;

    // Define desired creep counts based on controller level for clarity
    const desiredMiners = contrlLvl >= 2 ? Math.min(sources.length, 2) : (sources.length > 0 ? 1: 0);
    const desiredGrabbers = miners.length > 0 ? (contrlLvl >= 2 ? Math.min(miners.length, 2) : 1) : 0; // Grabbers scale with miners

    let desiredUpgraders = 1; // Default for RCL 3+
    if (contrlLvl === 1) desiredUpgraders = Math.max(1, 4 - harvesters.length); // Early game, many upgraders
    else if (contrlLvl === 2) desiredUpgraders = isConstructionSite ? 2 : 3;
    else if (contrlLvl >= 4) desiredUpgraders = Math.min(Math.floor((spawn.room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) || 0) / 50000), 3); // Scale with storage, max 3 for example
    if (desiredUpgraders === 0 && contrlLvl >=1) desiredUpgraders = 1; // Ensure at least 1 upgrader if RCL >=1

    let desiredBuilders = 0;
    if (isConstructionSite) {
        if (contrlLvl <= 2) desiredBuilders = 2;
        else if (contrlLvl <= 3) desiredBuilders = 3;
        else desiredBuilders = Math.min(Math.floor(spawn.room.find(FIND_CONSTRUCTION_SITES).length / 10) +1, 2) ; // Scale with number of sites, max 2-3
    }

    // Spawn Emergency Harvesters if no miners AND no grabbers, and few basic harvesters
    if (miners.length === 0 && grabbers.length === 0 && energyAvailable >= 200 && harvesters.length < 1) {
      this.spawnHarvester(spawn, staticName);
    }
    // Spawn main roles if energy is at capacity or there's significant storage
    else if (energyAvailable === energyCapacity || (spawn.room.storage && spawn.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) ) {
      if (miners.length < desiredMiners) {
        this.spawnMiner(spawn, staticName, sources);
      }
      else if (grabbers.length < desiredGrabbers) {
        this.spawnGrabber(spawn, staticName);
      }
      else if (upgraders.length < desiredUpgraders) {
        this.spawnUpgrader(spawn, staticName);
      }
      else if (builders.length < desiredBuilders && isConstructionSite) {
        this.spawnBuilder(spawn, staticName);
      }
    }
  },

  doNotDisturb: function (creep: Creep) {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && !creep.memory.working) {
      // If creep got some energy while 'not working' (e.g. from decay), switch to working
      creep.memory.working = true;
    } else if (creep.store.getFreeCapacity() === 0 && creep.memory.working) {
        // If creep is full and 'working' but has no task, it might need to switch state
        // This depends on role logic, doNotDisturb is usually for non-working state
    }

    const spawnToRally = Game.getObjectById(creep.memory.spawnId as Id<StructureSpawn>) || creep.room.find(FIND_MY_SPAWNS)[0];
    if (spawnToRally) {
        // Find an open spot near the spawn, but not too close to block it.
        // This simple version just moves to a fixed offset.
        const rallyPos = new RoomPosition(spawnToRally.pos.x - 2, spawnToRally.pos.y + 2, spawnToRally.pos.roomName);
        if (creep.pos.getRangeTo(rallyPos) > 1) {
            creep.moveTo(rallyPos, { visualizePathStyle: { stroke: "#555555" }, range:1 });
        }
    }
    creep.say("😴 idle");
  },

  /**
   * Finds the most suitable energy source for a creep to withdraw or pickup from.
   * The search order is: dropped resources, tombstones, ruins, containers, storage, and finally spawns.
   * If an energy source is found, the creep will attempt to pickup/withdraw or move towards it.
   * If no source is found, the creep will go into a "doNotDisturb" state.
   * @param {Creep} creep - The creep seeking energy.
   */
  findEnergy: function (creep: Creep): void {
    let target: Resource | Tombstone | Ruin | StructureContainer | StructureStorage | StructureSpawn | null = null;
    let action: "pickup" | "withdraw" = "withdraw"; // Default action

    // 1. Dropped resources (energy)
    target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > creep.store.getFreeCapacity() * 0.1 // Only if substantial
    });
    if (target) {
      action = "pickup";
    }

    // 2. Tombstones with energy
    if (!target) {
      target = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
        filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });
      action = "withdraw";
    }

    // 3. Ruins with energy
    if (!target) {
      target = creep.pos.findClosestByPath(FIND_RUINS, {
        filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0
      });
      action = "withdraw";
    }

    // 4. Containers with energy
    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 50
      }) as StructureContainer | null;
      action = "withdraw";
    }

    // 5. Storage with energy
    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity(RESOURCE_ENERGY) > 100 // Higher threshold for storage
      }) as StructureStorage | null;
      action = "withdraw";
    }

    // 6. Spawns with energy (if they have > 50)
    if (!target) {
      target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_SPAWN && s.store.getUsedCapacity(RESOURCE_ENERGY) > 50
      }) as StructureSpawn | null;
      action = "withdraw";
    }

    // Perform action or move
    if (target) {
      if (action === "pickup") {
        if (creep.pickup(target as Resource) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: 5 });
        }
      } else { // withdraw
        if (creep.withdraw(target as AnyStoreStructure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: 5 });
        }
      }
    } else {
      // If no energy source is found, call doNotDisturb
      this.doNotDisturb(creep);
    }
  },

  getEmptyingStructure: function (creep: Creep): Structure | null {
    // Priority: 1. Extensions, 2. Spawns (that need energy)
    let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (target) return target;

    // Priority 3: Towers (that need energy, e.g., below 75% capacity)
    target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType == STRUCTURE_TOWER &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > TOWER_CAPACITY * 0.25
    });
    if (target) return target;

    // Priority 4: Storage (if present)
    if (creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return creep.room.storage;
    }

    return null; // No structure needs energy or found
  }
};
