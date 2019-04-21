const fs = require('fs');
const request = require('request');
const CACHED_PLAYERS_PATH = __dirname + '/cachedPlayers.json';
const querystring = require('querystring');
require('dotenv').config();

const retrieveCachedPlayers = () => {
    return new Promise((resolve) => {
        fs.readFile(CACHED_PLAYERS_PATH, 'utf8', (err, contents) => {
            if (err) {
                console.log('Error retrieving cached players;', err);
            }
    
            const cachedPlayers = contents ? JSON.parse(contents) : contents;
            resolve(cachedPlayers);
        });
    });
}

const cachePlayersHash = (playersHash) => {
    fs.writeFile(CACHED_PLAYERS_PATH, JSON.stringify(playersHash), (err) => {
        if (err) {
            console.log('Error caching players:', err);
        }

        console.log('Cached players updated');
    });
}

const ensurePlayerInHash = (prevPlayersHash, player) => {
    if (prevPlayersHash[player]) {
        return new Promise((resolve) => {
            resolve({ ...prevPlayersHash });
        });
    } else {
        return addPlayerToHash(prevPlayersHash, player);
    }
}

const addPlayerToHash = (prevPlayersHash, player) => {
    return new Promise((resolve) => {
        getPlayerId(player).then((id) => {
            resolve({ ...prevPlayersHash, [player]: id});
        });
    });
}

const getPlayerId = (player) => {
    return new Promise((resolve) => {
        console.log('getting id for', player)
        const playerQuery = querystring.stringify({
            'post_type[]': 'player',
            s: ''
        }) + player.replace('\'', '').replace('ü', 'u').replace('-', ' ').split(' ').join('+');

        request({
            method: 'GET',
            uri: `${process.env.WNBA_SEARCH_BASE_URI}?${playerQuery}`,
            forever: true
        }, (err, response, body) => {
            const firstItem = JSON.parse(body).posts[0];
            resolve(firstItem ? firstItem.id : null);
        })
    })
}

const getPlayerIds = (players) => {
    return players.reduce((previousPromise, player) => {
        return previousPromise.then((hash) => {
            return ensurePlayerInHash(hash, player);
        });
    }, retrieveCachedPlayers()).then((playerIdsHash) => {
        cachePlayersHash(playerIdsHash);
        return playerIdsHash;
    });
}

module.exports = { getPlayerIds };