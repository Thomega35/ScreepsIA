  
var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            creep.say('🔄 harvest');
        }
        if(!creep.memory.upgrading && creep.store.getFreeCapacity() <= 0) {
            creep.memory.upgrading = true;
            creep.say('⚡ upgrade');
        }

        if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        else {
            /*var dropEnergies = creep.room.find(FIND_DROPPED_RESOURCES);
            //console.log(dropEnergies);*
            //TODO prendre energie spawn
            if (dropEnergies.length >= 1){
                var source = creep.pos.findClosestByRange(dropEnergies);
                if(creep.pickup(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source , {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }else{*/
            var depots = creep.room.find(FIND_STRUCTURES,{
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_SPAWN);/*STRUCTURE_STORAGE &&
                        structure.store.getUsedCapacity(RESOURCE_ENERGY) > 80000)*/
                }
            });
            var source = creep.pos.findClosestByRange(depots);
            if(creep.withdraw(source, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source , {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            //}
        }
    }
};

module.exports = roleUpgrader;