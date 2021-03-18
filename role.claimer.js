/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.claimer');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    run: function(creep) {
            //creep.say('(╯°□°）╯︵ ┻━┻');
            //console.log(Game.flags['Flag1']);
            //creep.moveTo(Game.flags['Flag1'], {visualizePathStyle: {stroke: '#ffaa00'}});
            //console.log(creep.room.controller.owner.username == creep.owner.username);
            var nbClaimerDansLaRoom = creep.room.find(FIND_MY_CREEPS).filter(creep => creep.memory.role == 'claimer').length;
            if (nbClaimerDansLaRoom >= 2 || (creep.room.controller.owner != null && creep.room.controller.owner.username == creep.owner.username)){
                var right = creep.room.find(FIND_EXIT_RIGHT);
                creep.moveTo(right[0], {visualizePathStyle: {stroke: '#ffffff'}});
            }else{
                if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE){
                    creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            //var ennemi = creep.room.find(FIND_HOSTILE_STRUCTURES);
            /*ennemifocus = creep.pos.findClosestByRange(ennemi);
            //ennemifocus = Game.getObjectById('604e2dc6d4bed222b0096128');
            //5bbcad509099fc012e6371a6
            //creep.attack(ennemis[0]);
            //creep.moveTo(ennemi, {visualizePathStyle: {stroke: '#ffaa00'}});
            //console.log(creep.rangedAttack(ennemi));
            if(creep.rangedAttack(ennemifocus) == -9){  
                creep.moveTo(ennemifocus, {visualizePathStyle: {stroke: '#ffaa00'}});
            }else if (creep.rangedAttack(ennemifocus) < 0){
                creep.moveTo(ennemifocus, {visualizePathStyle: {stroke: '#ffaa00'}});
            }*/
            //console.log();
            //reserveController()
        }
};