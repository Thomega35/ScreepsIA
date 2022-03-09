global.scriptSystem = require("./script.system");
global.roleHarvester = require("role.harvester");
global.roleUpgrader = require("role.upgrader");
global.roleUpgrader2 = require("role.upgrader2");
global.roleBuilder = require("role.builder");
global.roleHunter = require("role.hunter");
global.rolePrimihunter = require("role.primihunter");
global.roleMiner = require("role.miner");
global.roleClaimer = require("role.claimer");
global.roleGraber = require("role.graber");
global.scriptSystem = require("script.system");

/**
 * @param {*} role le role a rechercher parmis les creeps
 * @returns La liste de tout les creeps de l'utilisateur avec le role "role"
 */
function GetCreepsByRole(role) {
    var CreepList = [];
    for (var creepname in Game.creeps) {
        if (Game.creeps[creepname].memory.role == role) {
            CreepList.push(Game.creeps[creepname]);
        }
    }
    return CreepList;
}
/**
 * Fonction qui appelle la fonction run associee à chaque Creeps
 */
function updateAllCreeps() {
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        var role = creep.memory.role;
        if (roles.includes(role)) {
            global["role" + scriptSystem.strucFirst(creep.memory.role)]["run"](creep);
        }
    }
}
/**
 * Supprime les creeps de la "Memory" qui ne correspondent pas à des creeps de la "Game"
 * ATTENTION affiche les creeps supprimés dans la console
 */
function cleanMemory() {
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log("Clearing non-existing creep memory:", name);
        }
    }
}
/**
 * Trouve les Towers de la game, si cible attak et si structure endomagés, répare
 */
function updateTower() {
    for (let room in Game.rooms) {
        var towers = Game.rooms[room].find(FIND_STRUCTURES, {
            filter: function (object) {
                return object.structureType === STRUCTURE_TOWER;
            },
        });
        //EACH TOWER
        for (let towerIndex in towers) {
            var tower = towers[towerIndex];
            //ATTACK
            var closestHostile = tower.pos.findClosestByRange(
                FIND_HOSTILE_CREEPS,
                {
                    filter: (creep) => {
                        return !creep.name.toLowerCase().includes("scala");
                    },
                }
            );
            if (closestHostile) {
                tower.attack(closestHostile);
            }
            //SOIN
            var closestDamagedStructure = tower.pos.findClosestByRange(
                FIND_STRUCTURES,
                {
                    filter: (structure) =>
                        structure.hits < structure.hitsMax &&
                        structure.structureType != STRUCTURE_WALL &&
                        structure.hits < 30000,
                }
            );
            if (closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            } /*else{
            //REPAIR WALL
                var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_WALL && structure.hits < 1000)
                });
                if (closestDamagedStructure && tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY)/3*2){
                    tower.repair(closestDamagedStructure);
                }
            }*/
        }
    }
}

/**
 * Construit les creeps necessaire selon le niveau d'energie du spawn
 */ 
 function buildCreeps() {
    //VAR NAMENUMBER = RAND(0-100)
    var namenumber = scriptSystem.randPerso();
    var spawn = Game.spawns['Home'];
    var mapRole = roles.map(x => scriptSystem.nbCreepRole(x));
    var aconstruire = spawn.room.find(FIND_CONSTRUCTION_SITES);
    if (spawn.room.energyAvailable >= spawn.room.energyCapacityAvailable){
        if (mapRole[0] < 4){ //TODO
            console.log(spawn.spawnCreep([WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], base + "☄" + namenumber, {memory: {workroom : spawn.room, emptying:false, role: roles[0]}}));
        }else if (mapRole[1] < 3){
            console.log(spawn.spawnCreep([WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], base + "🛠" + namenumber, {memory: {working: false, emptying:false, role: roles[1]}}));
        }else if (aconstruire.length > 0 && mapRole[2] < 1){//TODO
            spawn.spawnCreep([WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE], base + "🔨" + namenumber, {memory: {working: false, emptying:false, role: roles[2]}});
        }
        console.log("[" + roles + "] [" + mapRole + "]");
    }else if(mapRole[0] < 3 && spawn.room.energyAvailable >= 300){
        spawn.spawnCreep([WORK, CARRY, CARRY, MOVE, MOVE], base + "☄" + namenumber, {memory: {workroom : spawn.room, emptying:false, role: roles[0]}});
    }
}

var base = "ESCALATOR";
//var roles = ['harvester', 'upgrader', 'builder', 'hunter', 'primihunter', 'upgrader2', 'miner', 'claimer'];
var roles = ["graber", "upgrader", "builder"];

module.exports.loop = function () {
    //PIXELS effet de bord
    scriptSystem.generatePixel();
    //UPDATE CREEPS
    updateAllCreeps();
    //MEMOIRE effet de bord
    cleanMemory();
    //UPDATE TOWERS
    //DEPENSE POTENTIELLEMENT DE L'ENERGIE
    updateTower();
    //CREATION CREEPS
    //DEPENSE POTENTIELLEMENT DE L'ENERGIE
    buildCreeps();
};
/*   for (spawnName in Game.spawns){
        spawn = Game.spawns[spawnName];
    //COMPTE NB OF CREEPS
        var lesCreepsDeLaRoom = spawn.room.find(FIND_MY_CREEPS);
        var nbHarvester = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[0]).length;
        var nbUpgrader = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[1]).length;
        var nbBuilder = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[2]).length;
        // var nbHunter = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[3]).length;
        // var nbPrimihunter = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[4]).length;
        // var nbUpgrader2 = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[5]).length;
        var miners = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[6]);
        var nbClaimer = GetCreepsByRole(roles[7]).length;
        var nbMiner = miners.length;
        var minebool = [false, false, false, false];
        for (name in miners){
            miner = miners[name];
            if (miner.memory.number <= 3){
                minebool[miner.memory.number] = true;
            }
        }
        var aconstruire = spawn.room.find(FIND_CONSTRUCTION_SITES);
    //Harvester de secours
        if (nbMiner == 0 && lesCreepsDeLaRoom.length > 0){
            lesCreepsDeLaRoom[0].memory.role = 'miner';
            lesCreepsDeLaRoom[0].memory.filon = 0;
        }
        if (nbHarvester == 0 && lesCreepsDeLaRoom.length > 1){
            lesCreepsDeLaRoom[1].memory.role = 'harvester';
        }

    //BUILD IF NOT ENOUGH
    
        var sources = spawn.room.find(FIND_SOURCES);
        // HELP     var roles = ['harvester', 'upgrader', 'builder', 'hunter', 'primihunter', 'upgrader2', 'miner'];
        if (spawn.room.energyAvailable >= spawn.room.energyCapacityAvailable){
            if (nbMiner < sources.length){
                var filon = 0;
                while(minebool[filon]){
                    filon = filon + 1;
                }
                spawn.spawnCreep([WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE], base + "⛏" + filon, {memory: {workoom : spawn.room, number : filon, role: roles[6]}});
            }else if (nbHarvester <3){
                spawn.spawnCreep([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], base + "🥡" + namenumber, {memory: {workroom : spawn.room, emptying:false, role: roles[0]}});
            }else if (nbBuilder <2 && aconstruire.length > 0){
                spawn.spawnCreep([WORK, WORK, WORK,  WORK,  CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], base + "🔨" + namenumber, {memory: {working: false, emptying:false, role: roles[2]}});
            }else if (nbUpgrader < 1){
                spawn.spawnCreep([WORK, WORK, WORK,  WORK,  WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], base + "🛠" + namenumber, {memory: {working: false, emptying:false, role: roles[1]}});
            }else if (nbClaimer <0){
                spawn.spawnCreep([CLAIM, CLAIM, MOVE, MOVE], base + "🦺" + namenumber, {memory: {working: false, emptying:false, role: roles[7]}});
            }
        }
    }*/
