import { Message } from "discord.js";
import { Command } from "../../types";
import db from '../../database-manager';
import ApiPlayer from '../../bancho/player';

export default class implements Command {
    name = "register";
    description = "Adds you to the list of players participating in the current " +
        "mappack challenge. If your osu username doesn't match your discord " +
        "nickname you will need to include your osu information.";
    args = [
        { arg: "osuid", required: false }
    ];
    alias = [ "reg" ];
    run = async function (msg: Message, { osuid }: { osuid: string | number }) {
        const dbplayer = await db.getPlayer(msg.author.id);
        if (dbplayer)
            return msg.channel.send("You've already registered this week!");

        const member = msg.member;
        // Last thing to try is basic username
        let id: string | number = msg.author.username;
        // If the author is in the server use their nick
        if (member && member.nickname)
            id = member.nickname;
        // If an id was given use that
        if (osuid)
            id = osuid;

        // Make sure they're not already in the database
        if (await db.getPlayer(id))
            return msg.channel.send("You've already registered this week!");

        // If they are a new registrant add them to the db
        const player = await ApiPlayer.buildFromApi(id);
        const result = await db.addPlayer({
            discordid: msg.author.id,
            osuid: player.user_id,
            osuname: player.username,
            scores: []
        });
        if (result.ok)
            return msg.channel.send(`Registered ${player.username}`);
        else
            return msg.channel.send("Couldn't register");
    };
}