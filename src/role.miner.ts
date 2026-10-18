// Miner only creep (need grabber to gather energy)
export const roleMiner = {
    run: function(creep: Creep) {
        if (!creep.memory.sourceId) {
            return;
        }
        const source = Game.getObjectById(creep.memory.sourceId);
        if (!source || creep.memory.role !== "miner") {
            return;
        }
        //mine ressource if in range or move to it
        if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        //drop all ressources
        creep.drop(RESOURCE_ENERGY);
    }
};