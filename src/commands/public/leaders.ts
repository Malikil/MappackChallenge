import { Message, MessageEmbed } from "discord.js";
import { Command, MappackMap, MappackMapset } from "../../types";
import db, { getCurrentPack, getCurrentPacks } from '../../database-manager';
import { Mode } from "../../bancho/enums";

export default class implements Command {
    name = "leaderboard";
    description = "Shows the current leaderboard for this week";
    args = [ { arg: 'mode', required: false } ];
    alias = [ "leaders" ];

    run = async (msg: Message, { mode }: { mode: Mode }) => {
        const packs = mode
                ? [ await getCurrentPack(mode) ]
                : await getCurrentPacks();
        const currentPlayer = await db.getPlayer(msg.author.id);
        const curResults: {
            player: string,
            scores: { [mode: number]: number }
        }[] = (await db.filter(p => p.scores.length > 0))
            .map(p => {
                let scoreSum = p.scores.reduce((s, c) => {
                    let pack = packs.find(p =>
                        p.maps.find(m =>
                            m.versions.find(v => v.mapId === c.beatmap)
                        )
                    );
                    if (pack)
                        s[pack.mode] += c.score;
                    return s;
                }, <{ [mode: number]: number }>{});
                return {
                    player: p.osuname,
                    scores: scoreSum
                };
            });
        const resultEmbed = new MessageEmbed()
            .setTitle("Current Standings")
            .setColor("#00aaff");

        // Display the current top 10s
        const titles = {
            [Mode.osu]: "Standard",
            [Mode.Taiko]: "Taiko",
            [Mode.Catch]: "Catch the Beat",
            [Mode.Mania]: "Mania"
        };
        const ranks = packs.map((p, i) => {
            resultEmbed.addField(
                `Top 10 ${titles[p.mode]}`,
                curResults.sort((a, b) => b.scores[Mode.osu] - a.scores[Mode.osu])
                    .slice(0, 10).reduce((p, c, i) => 
                        `${p}\n**${i + 1}.** ${c.player} - ${c.scores[Mode.osu].toFixed(1)}`
                    , '') || '\u200b',
                true
            );
            if (i % 3 === 1)
                resultEmbed.addField("\u200b", "\u200b", true);
            if (currentPlayer) {
                const pos = curResults.findIndex(pl => pl.player === currentPlayer.osuname);
                const score = currentPlayer.scores.reduce((s, c) => {
                    if (p.maps.find(m => m.versions.find(v => v.mapId === c.beatmap)))
                        return s + c.score;
                    return s;
                }, 0);
                if (score > 0)
                    return {
                        pos, score, mode: p.mode
                    };
            }
        }).filter(s => s);
        
        // Display the current player's rank
        if (ranks.length > 0) {
            resultEmbed.addField(
                "Your Ranks",
                ranks.map(r =>
                    `**${titles[r.mode]}** ${r.pos}. - ${r.score}`
                ).join("\n")
            );
        }

        resultEmbed.setFooter(`${curResults.length} plyers`).setTimestamp();
        return msg.channel.send(resultEmbed);
    };
}