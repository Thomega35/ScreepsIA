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

        var ennemi = creep.room.find(FIND_HOSTILE_STRUCTURES);
        ennemifocus = creep.pos.findClosestByRange(ennemi);
        //ennemifocus = Game.getObjectById('604e2dc6d4bed222b0096128');
        //5bbcad509099fc012e6371a6
        //creep.attack(ennemis[0]);
        //creep.moveTo(ennemi, {visualizePathStyle: {stroke: '#ffaa00'}});
        //console.log(creep.rangedAttack(ennemi));
        if(creep.rangedAttack(ennemifocus) == -9){
            creep.moveTo(ennemifocus, {visualizePathStyle: {stroke: '#ffaa00'}});
        }else if (creep.rangedAttack(ennemifocus) < 0){
            creep.moveTo(ennemifocus, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        //console.log();
    }
};