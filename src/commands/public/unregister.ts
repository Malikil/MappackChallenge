import { Message } from "discord.js";
import { Command } from "../../types";
import db from '../../database-manager';

export default class implements Command {
    name = "deregister";
    description = "Removes yourself from the player list and clears " +
        "all your current scores.";
    alias = [ "unregister", "unreg", "dereg" ];
    
    run = async function (msg: Message) {
        const result = await db.removePlayer(msg.author.id);
        if (result.n)
            return msg.channel.send("You have been deregistered.");
        else
            return msg.channel.send("Could not find matching player.");
    };
}