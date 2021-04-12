import { delay, seconds, hours, days, minutes } from './helpers/mstime';
import db, { getCurrentPacks, moveToNextPack, ready as dbReady } from './database-manager';
import Score from './bancho/score';
import { DbPlayer, MappackMap, MappackMapset } from './types';
import Mods from './bancho/mods';
import { Mode, Rank } from './bancho/enums';
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

const TIMER_TICKS = 4;
async function updateScores() {
    console.log("Beginning update scores");
    // Get maps from maplist
    const packsRaw = await getCurrentPacks();
    const pack = packsRaw.reduce((arr, c) =>
        arr.concat(c.maps)
    , <MappackMapset[]>[]);
    // I just really realized how many api requests this is going to be.
    // Try adding some wait time between requests so it's not absolutely insane
    const finalTime = pack.reduce((timer, mapset) => {
        // Find the current mode
        const mapsetMode = packsRaw.find(p => p.maps.find(m => m.setId === mapset.setId)).mode;
        mapset.versions.forEach((m, i) =>
            setTimeout(async (pm: MappackMap, mode: Mode) => {
                console.log(`Beginning update for ${pm.mapId} ${pm.version}`);
                // Get each player's score on the map, then update as needed
                let i = 0;
                const updates = await Promise.all(
                    await db.map((pp): Promise<DbPlayer> =>
                        // I'd like so space players out by 1 second each, rather than hitting the api
                        // with everything right off the bat. So this is a similar setTimeout trick as
                        // I did with maps, but because the new updated value of a player is important
                        // I need to find a way to return it.
                        new Promise(resolve =>
                            setTimeout(async (player: DbPlayer, map: MappackMap, mapMode: Mode) => {
                                console.log(`Looking ${player.osuname} on ${map.mapId} ${map.version}`);
                                // If the player has an updated score, return them as a DbPlayer
                                const oldIndex = player.scores.findIndex(s => s.beatmap === map.mapId);
                                const oldScore = player.scores[oldIndex];
                                console.log(`Old score is ${inspect(oldScore)}`);
                                const newScores = await Score.getFromApi(map.mapId, player.osuid, null, mapMode);
                                if (newScores.length < 1)
                                    return resolve(null);
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
                                    return resolve(null);
                                resolve(player);
                            }, seconds(i++), pp, pm, mode)
                        )
                    )
                ).then((u: DbPlayer[]) => u.filter(p => p));
                // Now players can be updated
                if (updates.length > 0)
                    db.updateAll(updates);
            }, minutes((timer + i) / TIMER_TICKS), m, mapsetMode)
        );
        return timer + mapset.versions.length;
    }, 0);
    setTimeout(() => console.log(`Score update finished`), minutes((finalTime + 1) / TIMER_TICKS));
    return finalTime;
}

function nextPack(channel?: TextChannel) {
    if (channel)
        channel.send("Beginning final scores update and switching to next mappack!");
    updateScores().then(async timer => {
        if (channel) {
            const oldPacks = await getCurrentPacks();
            setTimeout(async () => {
                // Display leaderboard
                const curResults: {
                    player: string,
                    scores: { [mode: number]: number }
                }[] = (await db.filter(p => p.scores.length > 0))
                    .map(p => {
                        let scoreSum = p.scores.reduce((s, c) => {
                            let pack = oldPacks.find(p =>
                                p.maps.find(m =>
                                    m.versions.find(v => v.mapId === c.beatmap)
                                )
                            );
                            if (pack)
                                s[pack.mode] = (s[pack.mode] || 0) + c.score;
                            return s;
                        }, <{ [mode: number]: number }>{});
                        return {
                            player: p.osuname,
                            scores: scoreSum
                        };
                    });
                const resultEmbed = new MessageEmbed()
                    .setTitle("Final Standings:")
                    .setColor("#0044aa");
        
                // Display the current top 10s
                oldPacks.forEach((p, i) => {
                    resultEmbed.addField(
                        `${p.packName}`,
                        curResults.sort((a, b) => b.scores[p.mode] - a.scores[p.mode])
                            .filter(s => s.scores[p.mode])
                            .slice(0, 20).reduce((str, c, i) => 
                                `${str}\n**${i + 1}.** ${c.player} - ${c.scores[p.mode].toFixed(1)}`
                            , '') || '\u200b',
                        true
                    );
                    if (i % 3 === 1)
                        resultEmbed.addField("\u200b", "\u200b", true);
                });

                channel.send(resultEmbed);
            }, minutes((timer + 1) / TIMER_TICKS));
        }
        console.log("Switching to next mappack");
        moveToNextPack();
    });
}

async function prunePlayers() {
    // Remove players who have no scores
    console.log(`Removed ${(await db.prunePlayers()).n} inactive players`);
    // Clear maps which aren't on the list
    const maplist = (await getCurrentPacks()).reduce((arr, c) =>
        arr.concat(c.maps)
    , <MappackMapset[]>[])
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
