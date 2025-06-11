import { CreepScript } from "script.creep";

// Classic autonom ressource gathering creep
export const roleHarvester = {
  run: function (creep: Creep) {
    if (creep.store.getFreeCapacity() > 0) {
      const sources = creep.room.find(FIND_SOURCES);
      const source = sources[0]; // Assuming harvesters always target the first source
      const harvestResult = creep.harvest(source);
      if (harvestResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      } else if (harvestResult === OK) {
         // const amountHarvested = creep.getActiveBodyparts(WORK) * 2; // Logic retained if needed elsewhere
         // console.log(`Harvester ${creep.name} harvested ${amountHarvested} energy from ${source.id}`); // LOG REMOVED
      }
      return;
    }

    const emptyingStructure = CreepScript.getEmptyingStructure(creep);
    if (!emptyingStructure) {
      return;
    }
    const amountToTransfer = creep.store[RESOURCE_ENERGY];
    if (creep.transfer(emptyingStructure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(emptyingStructure, { visualizePathStyle: { stroke: "#ffffff" } });
    } else if (amountToTransfer > 0) { // Log only if there was something to transfer
      // Note: This logs the amount the creep *attempted* to transfer.
      // Actual transferred amount might be less if target is full.
      // For more precise logging, one might need to check store before/after or target's free capacity.
      console.log(`Harvester ${creep.name} transferred ${amountToTransfer} energy to ${emptyingStructure.id} (${emptyingStructure.structureType})`);
    }
  }
};
