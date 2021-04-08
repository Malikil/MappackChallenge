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
        }[] = await db.map(p => {
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
            .setTitle("Current Leaders")
            .setColor("#0000ff");

        // Display the current top 10
        resultEmbed.addField(
            "Leaderboard",
            curResults.slice(0, 10).reduce((p, c, i) => 
                `${p}\n${i}. ${c.player} - ${c.score}`
            , '')
        )
    };
}