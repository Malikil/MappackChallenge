import { hours, days, minutes } from './helpers/mstime';
import db, { getCurrentPack, moveToNextPack, ready as dbReady } from './database-manager';
import Score from './bancho/score';
import { DbPlayer, MappackMap } from './types';
import Mods from './bancho/mods';
import { Rank } from './bancho/enums';
import { inspect } from 'util';
import { DMChannel, MessageEmbed, NewsChannel, TextChannel } from 'discord.js';

export function startActions(channel?: TextChannel | DMChannel | NewsChannel) {
    dbReady.then(updateScores);
    setInterval(updateScores, hours(6));
    intervalFrom(
        nextPack,
        new Date(Date.UTC(2021, 3, 12)),
        days(7),
        channel
    );
    intervalFrom(
        prunePlayers,
        new Date(Date.UTC(2021, 3, 13)),
        days(7)
    );
};
export default { startActions };

function intervalFrom(callback: (...args: any[]) => void, start: Date, interval: number, ...args: any[]) {
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
            callback(...args);
            timers.interval = setInterval(callback, interval, args);
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

const TIMERMOD = 2;
async function updateScores() {
    console.log("Beginning update scores");
    // Get maps from maplist
    const pack = await getCurrentPack();
    // I just really realized how many api requests this is going to be.
    // Try adding some wait time between requests so it's not absolutely insane
    const finalTime = pack.maps.reduce((timer, mapset) => {
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
                        console.log(`${player.osuname}'s highest score is ${highVal}`);
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
            }, minutes((timer + i) / TIMERMOD), m)
        );
        return timer + mapset.versions.length;
    }, 0);
    setTimeout(() => console.log(`Score update finished`), minutes((finalTime + 1) / TIMERMOD));
    return finalTime;
}

function nextPack(channel?: TextChannel) {
    if (channel)
        channel.send("Beginning final scores update and switching to next mappack!");
    updateScores().then(async timer => {
        if (channel) {
            const oldPack = (await getCurrentPack()).maps
                .reduce((arr, mp) => arr.concat(mp.versions), <MappackMap[]>[])
                .map(m => m.mapId);
            setTimeout(async () => {
                // Display leaderboard
                const curResults: {
                    player: string,
                    score: number
                }[] = (await db.filter(p => p.scores.length > 0))
                    .map(p => {
                        let scoreSum = p.scores.reduce((s, c) => {
                            if (oldPack.includes(c.beatmap))
                                return s + c.score;
                            return s;
                        }, 0);
                        return {
                            player: p.osuname,
                            score: scoreSum
                        };
                    }).filter(p => p.score > 0);
                curResults.sort((a, b) => a.score - b.score);
                const resultEmbed = new MessageEmbed()
                    .setTitle("Current Standings")
                    .setColor("#0044aa");
        
                // Display the current top 10
                resultEmbed.addField(
                    "Top 10 Leaderboard",
                    curResults.slice(0, 10).reduce((p, c, i) => 
                        `${p}\n**${i + 1}.** ${c.player} - ${c.score.toFixed(1)}`
                    , '') || '\u200b'
                );

                channel.send(resultEmbed);
            }, minutes((timer + 1) / TIMERMOD));
        }
        console.log("Switching to next mappack");
        moveToNextPack();
    });
}

async function prunePlayers() {
    // Remove players who have no scores
    console.log(`Removed ${(await db.prunePlayers()).n} inactive players`);
    // Clear maps which aren't on the list
    const maplist = (await getCurrentPack()).maps
        .reduce((arr, mp) => arr.concat(mp.versions), <MappackMap[]>[])
        .map(m => m.mapId);
    const updates = await db.map(player => {
        const filtered = player.scores.filter(m => maplist.includes(m.beatmap));
        if (filtered.length < player.scores.length) {
            player.scores = filtered;
            return player;
        }
    }).then((arr: DbPlayer[]) => arr.filter(p => p));
    
    db.updateAll(updates);
}
