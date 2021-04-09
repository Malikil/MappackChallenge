import { Message, MessageEmbed } from "discord.js";
import { Command } from "../../types";
import db from '../../database-manager';

export default class implements Command {
    name = "leaderboard";
    description = "Shows the current leaderboard for this week";
    alias = [ "leaders" ];

    run = async (msg: Message) => {
        const currentPlayer = await db.getPlayer(msg.author.id);
        const curResults: {
            player: string,
            score: number
        }[] = (await db.filter(p => p.scores.length > 0))
            .map(p => {
                let scoreSum = p.scores.reduce((s, c) => 
                    s + c.score
                , 0);
                return {
                    player: p.osuname,
                    score: scoreSum
                };
            });
        curResults.sort((a, b) => a.score - b.score);
        const resultEmbed = new MessageEmbed()
            .setTitle("Current Standings")
            .setColor("#0000ff");

        // Display the current top 10
        resultEmbed.addField(
            "Top 10 Leaderboard",
            curResults.slice(0, 10).reduce((p, c, i) => 
                `${p}\n${i}. ${c.player} - ${c.score}`
            , '')
        );
        // Display the current player's rank
        const pos = curResults.findIndex(p => p.player === currentPlayer.osuname);
        const score = currentPlayer.scores.reduce((p, c) => 
            p + c.score
        , 0);
        resultEmbed.addField(
            "Your Rank",
            `${pos}. ${currentPlayer.osuname} - ${score}`
        );

        resultEmbed.setFooter(`${curResults.length} plyers`).setTimestamp();
        return msg.channel.send(resultEmbed);
    };
}