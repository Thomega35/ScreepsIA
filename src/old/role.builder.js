var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

        //PASSAGE EN MODE RECUPERATION ENERGIE
        if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            creep.say('🔄Energyy');
        }

        //PASSAGE EN MODE CONSTRUCTION/REPARATION
        if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
            creep.say('🚧I\'m BOB');
        }

        //Si structure <33% passe en mode full repare avec emptying true
        // var siteReparation = creep.room.find(FIND_STRUCTURES,{
        //     filter: function(object){
        //         return (object.structureType === STRUCTURE_ROAD || object.structureType === STRUCTURE_CONTAINER) && (object.hits < object.hitsMax);
        //     }});
        // var siteConstruction = creep.room.find(FIND_CONSTRUCTION_SITES);
        // for (things in siteReparation){
        //     if (siteReparation[things].hits < siteReparation[things].hitsMax/3 || siteConstruction.length <= 0){
        //         creep.memory.emptying = true;
        //     }
        // }

        //console.log(creep.room.find(FIND_STRUCTURES));
        
        //SI LE CREEP A ENCORE DE L ENERGIE A DEPENSER
        if(creep.memory.building) {
            //SI MODE REPARATION
            // if (creep.memory.emptying){
            //     var targets = creep.room.find(FIND_STRUCTURES,{
            //     filter: function(object){
            //         return (object.structureType === STRUCTURE_ROAD || object.structureType === STRUCTURE_CONTAINER) && (object.hits < object.hitsMax);
            //     }});
            //     if (targets.length > 0){
            //         var target = creep.pos.findClosestByRange(targets);
            //         if(creep.repair(target) == ERR_NOT_IN_RANGE) {
            //         creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            //         }
            //     }else{
            //         creep.memory.emptying = false;
            //     }
            //SI MODE CONSTRUCTION
            //test
            // }else{
            targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            var target = creep.pos.findClosestByRange(targets);
            if(targets.length) {
                if(creep.build(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // }
        //SI LE CREEP CHERCHE DE L ENERGIE
        }else {
            /*var dropEnergies = creep.room.find(FIND_DROPPED_RESOURCES);
            var source = creep.pos.findClosestByRange(dropEnergies); 
            var sources = creep.room.find(FIND_SOURCES_ACTIVE);
            if(creep.pickup(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source , {visualizePathStyle: {stroke: '#ffaa00'}});
            }*/
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
        }
    }
};
module.exports = roleBuilder;