import { Message, RoleResolvable } from "discord.js";

export interface DbPlayer {
    discordid: string,
    osuname: string,
    osuid: number,
    scores: {
        score: number,
        beatmap: number
    }[]
};

export interface CommandArg {
    arg: string,
    required?: boolean,
    name?: string,
    description?: string
};

export interface Command {
    name: string,
    description: string,
    permissions?: RoleResolvable[],
    args?: CommandArg[],
    alias?: string[],
    skipValidation?: boolean,
    run: (msg: Message, args: object) => Promise<any>
};

export interface Validator {
    description: string,
    error: string,
    validate: (arg: string) => unknown
};
