/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.hunter');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    // creep.moveTo(Game.flag);
    /** @param {Creep} creep **/
    run: function(creep) {
        //creep.say('(╯°□°）╯︵ ┻━┻');
        //console.log(Game.flags['Flag1']);
        //creep.moveTo(Game.flags['Flag1'], {visualizePathStyle: {stroke: '#ffaa00'}});
        //var ennemi = Game.getObjectById('604db85d3db96f1c3180731d');
        //creep.attack(ennemis[0]);
        //creep.moveTo(ennemi, {visualizePathStyle: {stroke: '#ffaa00'}});
        //if(creep.rangedAttack(ennemi) == -9){
        //console.log(new RoomPosition(33,8,'E6N34'));
        
        
        
        var checkpoint = Game.flags['Chez Mael'];
        creep.moveTo(checkpoint, {visualizePathStyle: {stroke: '#ffaa00'}});
        
        
        
        
        // if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
        //     creep.memory.upgrading = false;
        //     creep.say('🔄 harvest');
        // }
        // if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
        //     creep.memory.upgrading = true;
        //     creep.say('⚡ upgrade');
        // }

        // if(creep.memory.upgrading) {
        //console.log(creep.upgradeController(creep.room.controller));
        //     if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        //         creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
        //     }
        // }
        // else {
        //    var sources = creep.room.find(FIND_SOURCES_ACTIVE);
        //    var source = sources[sources.length-1];
        //    if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
        //        creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
        //    }
        // }
        
        
        /*if (creep.pos.isEqualTo(checkpoint)){
            creep.memory.role = 'hunter';
        }*/
        //}
        //console.log();
    }
};