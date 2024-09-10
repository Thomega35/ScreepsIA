/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.miner');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
/** @param {Creep} creep **/
    run: function(creep) {
        
        var sources = creep.room.find(FIND_SOURCES);
        //recolte de la ressource
        if(creep.harvest(sources[creep.memory.number]) == ERR_NOT_IN_RANGE) {
            creep.moveTo(sources[creep.memory.number], {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        creep.drop(RESOURCE_ENERGY);
    }
};