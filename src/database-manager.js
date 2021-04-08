const { MongoClient, Db } = require('mongodb');
const DbPlayer = require('./types/db-player');

const mongoUser = process.env.MONGO_USER;
const mongoPass = process.env.MONGO_PASS;
const mongoUri = process.env.MONGO_URI;
const uri = `mongodb+srv://${mongoUser}:${mongoPass}@${mongoUri}`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

/** @type {Db} */
var db;
client.connect(err => {
    if (err)
        return console.log(err);
    else
        console.log("Connected to mongodb");

    db = client.db('packdb');
});

/**
 * @param {import('./types/db-player')} p
 */
function addPlayer(p) {
    db.collection('players').insertOne(p);
}

/**
 * @param {function(import('./types/db-player')): void} action
 */
function forEach(action) {
    return db.collection('players').find().forEach(action);
}

/**
 * @param {DbPlayer[]} players 
 */
function updateAll(players) {
    return db.collection('players').bulkWrite(players.map(p => (
        { updateOne: {
            filter: {
                osuid: p.osuid
            },
            update: {
                osuname: p.osuname,
                scores: p.scores
            }
        } }
    )));
}

module.exports = {
    addPlayer,
    forEach,
    updateAll
};
