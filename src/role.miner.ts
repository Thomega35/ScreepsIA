
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
        if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        //drop all ressources
        creep.drop(RESOURCE_ENERGY);
    }
};