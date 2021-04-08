export interface DbPlayer {
    discordid: string,
    osuname: string,
    osuid: number,
    scores: {
        score: number,
        beatmap: number
    }[]
};
