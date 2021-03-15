var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {

        var emptying = false;
        if (Game.spawns['Spawn1'].room.energyAvailable < Game.spawns['Spawn1'].room.energyCapacityAvailable){
            if (creep.store.getCapacity == 0){
                emptying = false;
            }
            if(emptying || creep.store.getFreeCapacity() > 0) {
                emptying = true;
                var sources = creep.room.find(FIND_SOURCES_ACTIVE);
                //recolte de la ressource
                if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
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
                targets.push();
                if(targets.length > 0) {
                    //dépot de la ressource
                    if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#ffffff'}});
                    }
                }
            }
            //en pause
        }else{
            creep.moveTo(new RoomPosition(15, 15, 'E1N33'), {visualizePathStyle: {stroke: '#ffffff'}});
        }
    }
};
//test
module.exports = roleHarvester;