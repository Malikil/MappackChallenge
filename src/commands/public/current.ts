import { Message, MessageEmbed } from "discord.js";
import { Command } from "../../types";
import { getCurrentPack } from '../../database-manager';

export default class implements Command {
    name = "current";
    description = "Displays the current mappack";
    alias = [ "pack" ];
    run = async (msg: Message) => {
        const curPack = await getCurrentPack();
        const resultEmbed = new MessageEmbed()
            .setTitle(curPack.packName)
            .setColor(`#${(Math.random() * 0xFFFFFF + 1).toString(16)}`)
            .setDescription(`[Download Mappack](${curPack.downloadUrl})`)
            .addFields(curPack.maps.map(m => ({
                name: `${m.artist} - ${m.title}`,
                value: m.versions.reduce((p, c) =>
                    `${p}\n${c.version} - ${c.value}`
                , `[Info](https://osu.ppy.sh/beatmapsets/${m.setId}) | ` +
                    `[Download](https://d/${m.setId})`),
                inline: true
            })))
            .setTimestamp();
        return msg.channel.send(resultEmbed);
    };
}