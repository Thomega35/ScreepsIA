module.exports = {
    pix : "",
    /**
     * Genere des pixels avec le CPU non utilisé
     * ATTENTION effet de bord, affiche dans la console le niveau du pixels a chaque changement
     */ 
    generatePixel: function(){
        if (this.pix != "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%") {
            this.pix = "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%";
            console.log(this.pix);
        }
        if (Game.cpu.bucket == 10000) {
            Game.cpu.generatePixel();
        }
    },
    /**
     * Met une majuscule au string mit en parametre
     * @param {String} a a string not null
     * @returns a with a Majuscule on the first character
     */
    strucFirst: function(a) {
        return (a + "").charAt(0).toUpperCase() + a.substring(1);
    },
    /**
     * renvoie un nombre aléatoire entre 0 et 100
     */
    randPerso: function() {
        if (Game.time - this.laps > 100) {
            this.laps = Game.time;
        }
        return Game.time - this.laps;
    },
    /**
     * Fonction utilisee pour la map des creeps
     * @param {*} role un string correspondant au role d'un creeps
     * @returns le nombre de creeps avec le role role
     */
    nbCreepRole: function(role) {
        var count = 0;
        for (var creepname in Game.creeps) {
            if (Game.creeps[creepname].memory.role == role) {
                count++;
            }
        }
        return count;
    },
    laps : 0
}