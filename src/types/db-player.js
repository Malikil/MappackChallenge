module.exports = class DbPlayer {
    /**
     * @param {Object} p
     * @param {string} p.discordid
     * @param {string} p.osuname
     * @param {number} p.osuid
     * @param {{
     *  score: number,
     *  beatmap: number
     * }[]} p.scores
     */
    constructor({ discordid, osuname, osuid, scores }) {
        this.discordid = discordid;
        this.osuname = osuname;
        this.osuid = osuid;
        this.scores = scores.map(s => { s.score, s.beatmap });
    }
};
