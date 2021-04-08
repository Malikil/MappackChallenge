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
export const ready: Promise<true> = new Promise((resolve, reject) => {
    client.connect(err => {
        if (err)
            return console.log(err);
        else
            console.log("Connected to mongodb");

        db = client.db('packdb');
        resolve(true);
    });
});

function addPlayer(p: DbPlayer) {
    return db.collection('players').insertOne(p);
}

function forEach(action: (p: DbPlayer) => void) {
    return db.collection('players').find().forEach(action);
}

function updateAll(players: DbPlayer[]) {
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

export default {
    addPlayer,
    forEach,
    updateAll
};
