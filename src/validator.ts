import { Mode } from "./bancho/enums";
import { Command, CommandArg, Validator } from "./types";

/**
 * Validates and converts a string into an args object based on the provided
 * expected args
 */
export function validateArgs(expected: CommandArg[], actual: string) {
    const cmdargs = getArgs(actual).slice(1);
    const validation: {
        rejected: boolean,
        args: object,
        error?: string
    } = {
        rejected: false,
        args: {}
    };
    if (!expected)
        expected = [];

    if (cmdargs.length > expected.length)
        validation.rejected = true;

    // Run through the expected args
    // make sure the required args are present, and all provided args are valid
    expected.forEach((arg, i) => {
        // Arg is required
            // Arg exists        => Validate
            // Arg doesn't exist => Error
        // Arg is not required
            // Arg exists        => Validate
            // Arg doesn't exist => Ignore
            
        if (i < cmdargs.length) {
            // Special 'any' argument type doesn't need to be validated
            if (arg.arg !== 'any') {
                const value = valid[arg.arg].validate(cmdargs[i]);
                if (value || value === 0) {
                    // If we haven't seen this arg yet, add it
                    if (!validation.args[arg.arg])
                        validation.args[arg.arg] = [ value ];
                    else
                        validation.args[arg.arg].push(value);
                }
                else {
                    validation.rejected = true;
                    validation.error = valid[arg.arg].error;
                }
            }
            // 'any' argument type
            else if (!validation.args[arg.name])
                validation.args[arg.name] = [ cmdargs[i] ];
            else
                validation.args[arg.name].push(cmdargs[i]);
        }
        else if (arg.required)
            validation.rejected = true;
    });

    // Run through the args and take singles out of their arrays
    Object.keys(validation.args).forEach(key => {
        if (validation.args[key].length < 2)
            validation.args[key] = validation.args[key][0];
    });
    
    return validation;
}

/**
 * Constructs a useage string for a set of expected arguments
 */
export function usageString(command: Command) {
    const seen = [];
    let header = "";
    let description = "";
    let alias = "";
    if (command.args)
        command.args.forEach(arg => {
            // Special 'any' arg type will come with its own description
            if (arg.arg !== "any") {
                if (arg.required)
                    header += ` <${arg.arg}>`;
                else {
                    header += ` [${arg.arg}]`;
                    if (!seen.includes(arg.arg))
                        description += `(Optional) `;
                }
                if (!seen.includes(arg.arg)) {
                    description += `${arg.arg}: ${valid[arg.arg].description}\n`;
                    seen.push(arg.arg);
                }
            }
            // 'any' argument type
            else if (arg.required) {
                header += ` <${arg.name}>`;
                if (!seen.includes(arg.name)) {
                    description += `${arg.name}: ${arg.description}\n`;
                    seen.push(arg.name);
                }
            }
            else {
                header += ` [${arg.name}]`;
                if (!seen.includes(arg.name)) {
                    description += `(Optional) ${arg.name}: ${arg.description}\n`;
                    seen.push(arg.name);
                }
            }
        });
    if (command.alias)
        alias = "Aliases: " + command.alias.reduce((p, c) => `${p}, ${c}`);
    return `Usage: ~${command.name}${header}\n${command.description}\n${description}${alias}`;
}

const valid: { [key: string]: Validator } = {
    osuid: {
        validate(arg: string): number | string {
            // If anything isn't a number
            if (arg.search(/\D/) > -1) {
                // This should account for both old site and new site
                if (arg.includes('ppy.sh/u')) {
                    let match = arg.match(/[0-9]+/);
                    if (match)
                        return parseInt(match[0]);
                }
                else
                    return arg;
            }
            else
                return parseInt(arg);
        },
        description: "Osu username, id, or profile link",
        error: "Could not parse osu id"
    },
    mode: {
        description: `Gamemode from "osu | taiko | ctb | mania" or the gamemode's number.`,
        error: "Gamemode not recognised",
        validate(arg: string): Mode {
            if (isNaN(Number(arg)))
                return Mode[arg];
            else { // Is a number
                const m = Mode[Number(arg)];
                if (m)
                    return Mode[m];
            }
        }
    }
}

/**
 * Splits a string into args
 */
export function getArgs(s: string): string[]
{
    // Handle multiple lines
    let lines = s.split('\n');
    return lines.reduce((arr, str) => {
        let args = str.match(/\\?.|^$/g).reduce((p: {a: string[], quote?: any }, c) => {
            if (c === '"')
                p.quote ^= 1;
            else if (!p.quote && c === ' ')
                p.a.push('');
            else
                p.a[p.a.length - 1] += c.replace(/\\(.)/, "$1");
            
            return  p;
        }, { a: [''] }).a;
        return arr.concat(args.reduce((p, c) => c ? p.concat(c) : p, []));
    }, []);
}
