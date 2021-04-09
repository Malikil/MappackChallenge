import { Message } from "discord.js";
import { Command, MappackMapset, PackState } from "../../types";
import { getArgs, usageString } from '../../validator';
import Beatmap from '../../bancho/beatmap';
import { addPack } from '../../database-manager';

export default class implements Command {
    name = "nextpack";
    description = "Queues a mappack update";
    permissions = [ process.env.ROLE_ADMIN ];
    args = [
        { arg: 'any', name: "pack", description: "The beatmap pack name", required: true },
        { arg: 'any', name: "downloadUrl", description: "Where can the pack be downloaded from", required: true },
        { arg: 'any', name: "mapsetIds", description: "The __mapset__ ids contained in the pack", required: true }
    ];
    skipValidation = true;
    
    run = async (msg: Message) => {
        // Get args and skip the command
        const args = getArgs(msg.content).slice(1);
        // Make sure there are enough args
        if (args.length < 3)
            return msg.channel.send(usageString(this));
        // Pack id and download url should be the first two args
        const packId = args.shift();
        const downloadUrl = args.shift();
        // Make sure download url looks like a link
        if (!downloadUrl.match(/^https?:\/\//))
            return msg.channel.send("Invalid URL");

        // Get the mapsets and parse them into the database format
        const maps = await Promise.all(args.map(
            async (msid): Promise<MappackMapset> => {
                const setId = parseInt(msid);
                const mapset = await Beatmap.getMapset(setId);
                return {
                    setId,
                    artist: mapset[0].artist,
                    title: mapset[0].title,
                    versions: mapset.map(m => ({
                        mapId: m.beatmap_id,
                        version: m.version,
                        value: parseFloat(m.difficultyrating.toFixed(1))
                    }))
                };
            }
        ));
        // Add to the database
        const result = await addPack({
            packName: packId,
            downloadUrl,
            state: PackState.Upcoming,
            maps
        });
        if (result.ok)
            return msg.channel.send(`Added ${packId} as an upcoming mappack`);
        else
            return msg.channel.send("Couldn't add mappack");
    };
};
