module.exports = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25){
            this.emptying = false;
        }
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0){
            this.emptying = true;
        }

        if (!this.sources){
            this.sources = creep.room.find(FIND_SOURCES);
        }
	    if(!this.emptying) {
            if(creep.harvest(this.sources[0]) == ERR_NOT_IN_RANGE && creep.harvest(this.sources[1]) == ERR_NOT_IN_RANGE) {
                if (creep.moveTo(this.sources[0], {visualizePathStyle: {stroke: '#ffaa00'}}) == ERR_NO_PATH){
                    var temp = this.sources[0];
                    this.sources[0] = this.sources[1];
                    this.sources[1] = temp;
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
    sources : 0,
    emptying : false
};