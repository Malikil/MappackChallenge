import { MongoClient, Db } from 'mongodb';
import { Mode } from './bancho/enums';
import { DbMappack, DbPlayer, PackState } from './types';

const mongoUser = process.env.MONGO_USER;
const mongoPass = process.env.MONGO_PASS;
const mongoUri = process.env.MONGO_URI;
const uri = `mongodb+srv://${mongoUser}:${mongoPass}@${mongoUri}`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

var db: Db;
export const ready: Promise<boolean> = new Promise<boolean>((resolve, reject) => {
    client.connect(err => {
        if (err)
            return reject(err);
        else
            console.log("Connected to mongodb");

        db = client.db('packdb');
        resolve(true);
    });
}).catch(err => {
    console.error(err);
    return false;
});

/**
 * Prepares a string to be used as the match in a regex match
 */
 function regexify(str: string, options?: string)
 {
     str = str.replace(/_/g, "(?: |_)")
         .replace('[', '\\[')
         .replace(']', "\\]")
         .replace('+', "\\+");
     return new RegExp(`^${str}$`, options);
 }

async function addPlayer(p: DbPlayer) {
    return (await db.collection('players').insertOne(p)).result;
}

async function removePlayer(discordid: string) {
    return (await db.collection('players').deleteOne({ discordid })).result;
}

function getPlayer(playerid: string | number): Promise<DbPlayer> {
    const query: { $or: { [key: string]: any }[] } = {
        $or: [
            { osuid: playerid },
            { discordid: playerid }
        ]
    };
    if (typeof playerid === "string")
        query.$or.push({ osuname: regexify(playerid) });
    return db.collection('players').findOne(query);
}

async function prunePlayers() {
    return (await db.collection('players').deleteMany({ scores: { $size: 0 } })).result;
}

async function updateAll(players: DbPlayer[]) {
    return db.collection('players').bulkWrite(players.map(p => ({
        updateOne: {
            filter: {
                osuid: p.osuid
            },
            update: {
                $set: {
                    osuname: p.osuname,
                    scores: p.scores
                }
            }
        }
    })));
}

//#region Map pack management
export async function addPack(pack: DbMappack) {
    return (await db.collection('packs').insertOne(pack)).result;
};

export async function getCurrentPack(mode: Mode): Promise<DbMappack> {
    return db.collection('packs').findOne({
        state: PackState.Current, mode
    });
};

export async function getCurrentPacks(): Promise<DbMappack[]> {
    return db.collection('packs').find({
        state: PackState.Current
    }).toArray();
};

export async function getPackCounts(): Promise<{
    [PackState.Past]: number,
    [PackState.Current]: number,
    [PackState.Upcoming]: number
}> {
    // Prepare results object
    const result = {
        [PackState.Past]: 0,
        [PackState.Current]: 0,
        [PackState.Upcoming]: 0
    };
    await db.collection('packs').find().forEach((p: DbMappack) =>
        result[p.state]++
    );
    return result;
};

export async function moveToNextPack() {
    // Set the currently active pack(s) to past
    const pastRes = await db.collection('packs').updateMany(
        { state: PackState.Current },
        { $set: { state: PackState.Past } }
    );
    // Set an upcoming pack to current for each mode
    const upcoResult = await db.collection('packs').bulkWrite([
        { updateOne: { filter: {
                state: PackState.Upcoming,
                mode: Mode.osu
            }, update: { $set: {
                state: PackState.Current
            } } }
        },
        { updateOne: { filter: {
                state: PackState.Upcoming,
                mode: Mode.Taiko
            }, update: { $set: {
                state: PackState.Current
            } } }
        },
        { updateOne: { filter: {
                state: PackState.Upcoming,
                mode: Mode.Catch
            }, update: { $set: {
                state: PackState.Current
            } } }
        },
        { updateOne: { filter: {
                state: PackState.Upcoming,
                mode: Mode.Mania
            }, update: { $set: {
                state: PackState.Current
            } } }
        }
    ]);
    return !!pastRes.result.ok && !!upcoResult.result.ok;
};
//#endregion

//#region ========== Array-like Functions ==========
function forEach(action: (p: DbPlayer) => void) {
    return db.collection('players').find().forEach(action);
}

function map(action: (p: DbPlayer) => any) {
    return db.collection('players').find().map(action).toArray();
}

async function filter(predicate: (p: DbPlayer) => boolean) {
    const results: DbPlayer[] = [];
    await db.collection('players').find().forEach(p => {
        if (predicate(p))
            results.push(p);
    });
    return results;
}
//#endregion

export default {
    addPlayer,
    removePlayer,
    getPlayer,
    prunePlayers,
    forEach,
    map,
    filter,
    updateAll
};
