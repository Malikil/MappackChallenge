import { Message, MessageEmbed } from "discord.js";
import { Command, MappackMap } from "../../types";
import db, { getCurrentPack } from '../../database-manager';

export default class implements Command {
    name = "leaderboard";
    description = "Shows the current leaderboard for this week";
    alias = [ "leaders" ];

    run = async (msg: Message) => {
        const maplist = (await getCurrentPack()).maps
            .reduce((arr, mp) => arr.concat(mp.versions), <MappackMap[]>[])
            .map(m => m.mapId);
        const currentPlayer = await db.getPlayer(msg.author.id);
        const curResults: {
            player: string,
            score: number
        }[] = (await db.filter(p => p.scores.length > 0))
            .map(p => {
                let scoreSum = p.scores.reduce((s, c) => {
                    if (maplist.includes(c.beatmap))
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
        // Display the current player's rank
        if (currentPlayer) {
            const pos = curResults.findIndex(p => p.player === currentPlayer.osuname);
            if (pos > -1) {
                const score = currentPlayer.scores.reduce((p, c) => 
                    p + c.score
                , 0);
                resultEmbed.addField(
                    "Your Rank",
                    `**${pos + 1}.** ${currentPlayer.osuname} - ${score.toFixed(1)}`
                );
            }
        }

        resultEmbed.setFooter(`${curResults.length} plyers`).setTimestamp();
        return msg.channel.send(resultEmbed);
    };
}