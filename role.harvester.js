var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        //emptying true = Depense ses ressources
        //RECHERCHE LES ENDROITS OU PRENDRE DE L'ENERGIE
        var towithtomb = creep.room.find(FIND_TOMBSTONES).filter(x => x.store[RESOURCE_ENERGY]>0);
        var towithenergy = creep.room.find(FIND_DROPPED_RESOURCES);
        var towithruin = creep.room.find(FIND_RUINS).filter(x => x.store[RESOURCE_ENERGY]>0);
        //var tombstoneToWithdraw2 = creep.room.find(FIND_RUINS).filter(x => x.store[RESOURCE_ENERGY]>0);
        var toTakeFrom = (towithtomb.concat(towithenergy)).concat(towithruin);
        console.log(toTakeFrom);
        
        //ACTUALISATION EMPTYING
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0){
            creep.memory.emptying = true;
        }
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25){
            creep.memory.emptying = false;
        }

        


        if (toTakeFrom.length > 0 || creep.memory.emptying){
            var source = creep.pos.findClosestByRange(toTakeFrom); 
            
            
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
            creep.moveTo(new RoomPosition(25, 25, 'E9S54'), {visualizePathStyle: {stroke: '#ffffff'}});
        }
    }
};
module.exports = roleHarvester;

   /* //TEST
    console.log(creep.room.name)
    console.log(creep.memory.workroom.name)
    console.log(creep.room.name == creep.memory.workroom.name)*/