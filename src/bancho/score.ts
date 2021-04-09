import { Rank } from "./enums";
import Mods from "./mods";
import { BanchoScore } from "./types";
import nfetch from 'node-fetch';
const OSUKEY = process.env.OSUKEY;

export default class Score {
    score_id: number;
    score: number;
    username: string;
    count300: number;
    count100: number;
    count50: number;
    countmiss: number;
    maxcombo: number;
    countkatu: number;
    countgeki: number;
    perfect: boolean;
    enabled_mods: Mods;
    user_id: number;
    date: Date;
    rank: Rank;
    pp: number;
    replay_available: boolean;
    
    constructor(score: BanchoScore) {
        // Identification
        this.score_id = parseInt(score.score_id);
        this.user_id = parseInt(score.user_id);
        this.username = score.username;
        this.date = new Date(score.date.replace(" ", "T") + "Z");
        
        // Score info
        this.score = parseInt(score.score);
        this.enabled_mods = parseInt(score.enabled_mods);
        this.rank = Rank[score.rank];
        this.count300 = parseInt(score.count300);
        this.count100 = parseInt(score.count100);
        this.count50 = parseInt(score.count50);
        this.countmiss = parseInt(score.countmiss);
        this.countkatu = parseInt(score.countkatu);
        this.countgeki = parseInt(score.countgeki);
        this.maxcombo = parseInt(score.maxcombo);
        this.perfect = !!parseInt(score.perfect);
        this.pp = parseFloat(score.pp);

        // Misc
        this.replay_available = !!parseInt(score.replay_available);
    }

    static async getFromApi(mapid: number, user?: number | string, mods?: Mods) {
        const scores = await nfetch(`https://osu.ppy.sh/api/get_scores?k=${OSUKEY}&b=${mapid}${
                    user ? `&u=${user}` : ""
                }&mods=${mods & Mods.DifficultyMods}`)
            .then((res): Promise<BanchoScore[]> => res.json());
        if (scores)
            return scores.map(s => new Score(s));
        // Return undefined if no scores found
    }
};
