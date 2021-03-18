var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        
        //emptying true = Depense ses ressources
        
        console.log(creep.room)
        console.log(creep.memory.workroom)
        console.log(creep.room == creep.memory.workroom)
        
        var dropEnergies = creep.room.find(FIND_DROPPED_RESOURCES);
        var source = creep.pos.findClosestByRange(dropEnergies); 
        if (dropEnergies.length >= 0 || creep.memory.emptying){
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25){
                creep.memory.emptying = false;
            }
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0){
                creep.memory.emptying = true;
            }
            
            if(!creep.memory.emptying) {
                //recolte de la ressource
                if(creep.pickup(source) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(source , {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                if(source == null){
                    var depots = creep.room.find(FIND_STRUCTURES,{
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_STORAGE);
                        }
                    });
                    source = creep.pos.findClosestByRange(depots);
                    if(creep.withdraw(source, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source , {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                }
            }else {
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                if(targets.length <= 0) {
                    var targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_TOWER&&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                        }
                    });
                }
                if(targets.length <= 0) {
                    var targets = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_STORAGE);
                        }
                    });
                }
                var target = creep.pos.findClosestByRange(targets);
                //dépot de la ressource
                if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            //en pause
        }else{
            creep.moveTo(new RoomPosition(15, 15, 'E1N33'), {visualizePathStyle: {stroke: '#ffffff'}});
        }
    }
};
module.exports = roleHarvester;