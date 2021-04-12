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
            .setColor(`#${(Math.random() * 0xFFFFFF + 1).toString(16)}`);
        // Construct the pack string, capped at 2k chars for description and 1k for fields
        const packStrings = curPack.maps.reduce((p, m) => {
            const mapString = `\n[${m.artist} - ${m.title}](https://osu.ppy.sh/beatmapsets/${m.setId}) -${
                m.versions.sort((a, b) => a.value - b.value).reduce((pv, v) => `${pv} | ${v.value}`, "").slice(2)
            }`;
            // Add the string to the first spot which is empty
            if (p.desc.length + mapString.length < 2000)
                p.desc += mapString;
            else {
                // Find the first field this map can be added to
                for (let i = 0; i < p.fields.length; i++)
                    if (p.fields[i].length + mapString.length < 1000) {
                        p.fields[i] += mapString;
                        return p;
                    }
                // Neither description nor any existing field has enough space
                p.fields.push(mapString);
            }
            return p;
        }, {desc: "", fields: <string[]>[]});

        resultEmbed.setDescription(packStrings.desc)
            .addFields(
                packStrings.fields.map(str => ({
                    name: "\u200b",
                    value: str
                }))
            ).addField("\u200b", `[Download Mappack](${curPack.downloadUrl})`);
        return msg.channel.send(resultEmbed);
    };
}