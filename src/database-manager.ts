import { MongoClient, Db } from 'mongodb';
import { DbPlayer } from './types';

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
    forEach,
    map,
    filter,
    updateAll
};
