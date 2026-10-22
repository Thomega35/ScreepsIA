import { ExpansionScript } from "script.expansion";

// Self-sufficient worker for a freshly claimed room: harvests locally, builds the first spawn, keeps the controller alive
export const rolePioneer = {
  run(creep: Creep) {
    const target = creep.memory.target;
    if (!target || ExpansionScript.travelTo(creep, target)) {
      return;
    }
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
      });
      if (dropped) {
        if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
          creep.moveTo(dropped);
        }
        return;
      }
      const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    const controller = creep.room.controller;
    if (!controller?.my) {
      // Waiting for the claimer
      if (controller) {
        creep.moveTo(controller, { range: 3 });
      }
      return;
    }
    if (controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[controller.level] / 4) {
      if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3 });
      }
      return;
    }
    const spawn = creep.room.find(FIND_MY_SPAWNS).find(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    if (spawn) {
      if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn);
      }
      return;
    }
    const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
    const site = sites.find(s => s.structureType === STRUCTURE_SPAWN) ?? creep.pos.findClosestByRange(sites);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }
    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3 });
    }
  }
};
