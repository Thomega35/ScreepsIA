module.exports = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.emptying && creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25){
            creep.memory.emptying = false;
            creep.memory.sources = creep.room.find(FIND_SOURCES);
        }
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0){
            creep.memory.emptying = true;
        }

	    if(!creep.memory.emptying) {
            if(creep.harvest(Game.getObjectById(Game.getObjectById(creep.memory.sources[0].id).id)) == ERR_NOT_IN_RANGE && creep.harvest(Game.getObjectById(creep.memory.sources[1].id)) == ERR_NOT_IN_RANGE) {
                if (creep.moveTo(Game.getObjectById(creep.memory.sources[0].id), {visualizePathStyle: {stroke: '#ffaa00'}}) == ERR_NO_PATH){
                    var temp = Game.getObjectById(creep.memory.sources[0].id);
                    Game.getObjectById(creep.memory.sources[0].id) = Game.getObjectById(creep.memory.sources[1].id);
                    Game.getObjectById(creep.memory.sources[1].id) = temp;
                }
            }
        }
        else {
            var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER) && 
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
            });
            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
	},
};