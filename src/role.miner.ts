import { SystemScript } from "script.system";

// Tile next to both the source and its link, free of other creeps
function findLinkSpot(creep: Creep, source: Source, link: StructureLink): RoomPosition | null {
  const terrain = creep.room.getTerrain();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = source.pos.x + dx;
      const y = source.pos.y + dy;
      if ((dx === 0 && dy === 0) || terrain.get(x, y) === TERRAIN_MASK_WALL) {
        continue;
      }
      if (Math.max(Math.abs(x - link.pos.x), Math.abs(y - link.pos.y)) !== 1) {
        continue;
      }
      const pos = new RoomPosition(x, y, creep.room.name);
      const occupant = pos.lookFor(LOOK_CREEPS)[0];
      if (occupant && occupant.id !== creep.id) {
        continue;
      }
      if (pos.lookFor(LOOK_STRUCTURES).some(s => (OBSTACLE_OBJECT_TYPES as string[]).includes(s.structureType))) {
        continue;
      }
      return pos;
    }
  }
  return null;
}

// Miner only creep (need grabber to gather energy, or a source link)
export const roleMiner = {
  run(creep: Creep) {
    if (!creep.memory.sourceId) {
      return;
    }
    const source = Game.getObjectById(creep.memory.sourceId);
    if (!source || creep.memory.role !== "miner") {
      return;
    }
    const link =
      creep.getActiveBodyparts(CARRY) > 0
        ? SystemScript.getLinks(creep.room).sources.find(l => l.pos.inRangeTo(source, 2))
        : undefined;
    if (link) {
      if (!creep.pos.isNearTo(source) || !creep.pos.isNearTo(link)) {
        creep.moveTo(findLinkSpot(creep, source, link) ?? source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      creep.harvest(source);
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          creep.transfer(link, RESOURCE_ENERGY);
        }
      }
      return;
    }
    // mine ressource if in range or move to it
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    // drop all ressources
    creep.drop(RESOURCE_ENERGY);
  }
};
