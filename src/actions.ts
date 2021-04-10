import { hours, days, minutes } from './helpers/mstime';
import { default as db, getCurrentPack, ready as dbReady } from './database-manager';
import Score from './bancho/score';
import { DbPlayer, MappackMap } from './types';
import Mods from './bancho/mods';
import { Rank } from './bancho/enums';
import { inspect } from 'util';

export function startActions() {
    dbReady.then(updateScores);
    setInterval(updateScores, hours(12));
    intervalFrom(
        nextPack,
        new Date(Date.UTC(2021, 4, 3)),
        days(7)
    );
};
export default { startActions };

function intervalFrom(callback: () => void, start: Date, interval: number) {
    // Figure out how long to wait
    // If the start date has already passed figure out when the
    // next regular interval should be happening
    const now = new Date(Date.now());
    let init = start.valueOf() - now.valueOf();
    if (init < 0) {
        init %= interval;
        init += interval;
    }
    const timers: {
        timeout: NodeJS.Timeout,
        interval?: NodeJS.Timeout
    } = {
        timeout: setTimeout(() => {
            callback();
            timers.interval = setInterval(callback, interval);
        }, init)
    };
    return timers;
}

function calc(m: MappackMap, s: Score) {
    // Get base value
    let pointValue = m.value;
    const mods = s.enabled_mods;
    if (mods & Mods.Perfect)
        pointValue *= 2;
    else if (mods & Mods.SuddenDeath)
        pointValue *= 1.5;

    // Add performance bonuses
    if (!(mods & Mods.Perfect) && s.rank >= Rank.SS)
        pointValue++;
    if (!(mods & Mods.SuddenDeath) && s.perfect)
        pointValue++;

    // Mod bonuses
    if (mods & Mods.HalfTime)   pointValue -= 1;
    if (mods & Mods.Hidden)     pointValue += 1;
    if (mods & Mods.HardRock)   pointValue += 1;
    if (mods & Mods.Easy && m.value > 4) pointValue += 1;
    if (mods & Mods.DoubleTime) pointValue += 2;
    if (mods & Mods.Flashlight) pointValue += 2;

    return pointValue;
}

async function updateScores() {
    console.log("Beginning update scores");
    // Get maps from maplist
    const pack = await getCurrentPack();
    // I just really realized how many api requests this is going to be.
    // Try adding some wait time between requests so it's not absolutely insane
    pack.maps.reduce((timer, mapset) => {
        mapset.versions.forEach((m, i) =>
            setTimeout(async (map: MappackMap) => {
                console.log(`Updating scores for ${map.mapId} ${map.version}`);
                // Get each player's score on the map, then update as needed
                const updates = await Promise.all(
                    await db.map(async (player): Promise<DbPlayer> => {
                        console.log(`Looking for scores from ${player.osuname}`);
                        // If the player has an updated score, return them as a DbPlayer
                        const oldIndex = player.scores.findIndex(s => s.beatmap === map.mapId);
                        const oldScore = player.scores[oldIndex];
                        console.log(`Old score is ${inspect(oldScore)}`);
                        const newScores = await Score.getFromApi(map.mapId, player.osuid);
                        if (newScores.length < 1)
                            return;
                        // Find the highest new score
                        const highest = newScores.reduce((b, s) => calc(map, s) > calc(map, b) ? s : b);
                        // If the new score is higher, set it and return the player, otherwise return null
                        const highVal = calc(map, highest);
                        console.log(`Highest new score is ${highVal}`);
                        if (!oldScore)
                            player.scores.push({ score: highVal, beatmap: map.mapId });
                        else if (highVal > oldScore.score)
                            player.scores[oldIndex].score = highVal;
                        else
                            return;
                        return player;
                    })
                ).then((u: DbPlayer[]) => u.filter(p => p));
                // Now players can be updated
                if (updates.length > 0)
                    db.updateAll(updates);
            }, minutes(timer + i), m)
        );
        return timer + mapset.versions.length;
    }, 0);
    
    // If a higher score is found, update the player's db entry
}

function nextPack() {
    // Update the database to use the next mappack
}
