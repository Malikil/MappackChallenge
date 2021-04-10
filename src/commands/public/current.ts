import { Message, MessageEmbed } from "discord.js";
import { Command } from "../../types";
import { getCurrentPack } from '../../database-manager';
import { Mode } from "../../bancho/enums";

export default class implements Command {
    name = "current";
    description = "Displays the current mappack";
    args = [
        { arg: 'mode', required: false }
    ];
    alias = [ "pack" ];
    run = async (msg: Message, { mode }: { mode: Mode }) => {
        if (!mode)
            mode = Mode.osu;
        const curPack = await getCurrentPack(mode);
        const resultEmbed = new MessageEmbed()
            .setTitle(curPack.packName)
            .setColor(`#${(Math.random() * 0xFFFFFF + 1).toString(16)}`)
            .setDescription(curPack.maps.reduce((p, m) =>
                `${p}\n[${m.artist} - ${m.title}](https://osu.ppy.sh/beatmapsets/${m.setId}) - ${
                    m.versions.sort((a, b) => a.value - b.value).reduce((pv, v) => `${pv} | ${v.value}`, "").slice(2)
                }`
            , ''))
            .addField("\u200b", `[Download Mappack](${curPack.downloadUrl})`);
        return msg.channel.send(resultEmbed);
    };
}