// Miner only creep (need grabber to gather energy)
export const roleMiner = {
    run: function(creep: Creep) {
        if (!creep.memory.source) {
            return;
        }
        const source = Game.getObjectById(creep.memory.source.id);
        if (!source || creep.memory.role !== "miner") {
            return;
        }
        //mine ressource if in range or move to it
        const harvestResult = creep.harvest(source);
        if(harvestResult == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        } else if (harvestResult === OK) {
             // const amountHarvested = creep.getActiveBodyparts(WORK) * 2; // Logic retained
             // console.log(`Miner ${creep.name} harvested ${amountHarvested} energy from ${source.id}`); // LOG REMOVED
        }

        //drop all ressources
        const amountToDrop = creep.store[RESOURCE_ENERGY];
        if (amountToDrop > 0) { // Only log if there's something to drop
            const dropResult = creep.drop(RESOURCE_ENERGY);
            if (dropResult === OK) {
                 // console.log(`Miner ${creep.name} dropped ${amountToDrop} energy at ${creep.pos}`); // LOG REMOVED
            }
        } else {
            // Still call drop if amount is 0, to ensure original behavior if creep had other resources.
            // Though for a miner, it's unlikely.
            creep.drop(RESOURCE_ENERGY);
        }
    }
};