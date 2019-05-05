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

const standardizeName = (name, removeSpaces=false) => {
    const standardizedName = name
        .replace(/ü/g, 'u')
        .replace(/í/g, 'i')
        .replace(/é/g, 'e')
        .replace(/è/g, 'e')
        .replace(/ñ/g, 'n')
        .replace(/ö/g, 'o')
        .replace(/-/g, ' ')
        .replace(/'/g, '')
        .toLowerCase();
    return removeSpaces ? standardizedName.replace(/\s/g, '') : standardizedName;
}

const getPlayerId = (player) => {
    return new Promise((resolve) => {
        console.log('getting id for', player)
        const playerQuery = querystring.stringify({
            'post_type[]': 'player',
            s: ''
        }) + standardizeName(player).split(' ').join('+');

        request({
            method: 'GET',
            uri: `${process.env.WNBA_SEARCH_BASE_URI}?${playerQuery}`,
            forever: true
        }, (err, response, body) => {
            const firstItem = JSON.parse(body).posts[0];
            if (firstItem) {
                resolve(firstItem.id)
            } else {
                // Search by last name(s)
                const newQuery = querystring.stringify({
                    'post_type[]': 'player',
                    s: ''
                }) + player.split(' ').slice(1).join('+');
                request({
                    method: 'GET',
                    uri: `${process.env.WNBA_SEARCH_BASE_URI}?${newQuery}`,
                    forever: true
                }, (err, response, body) => {
                    const matchItem = JSON.parse(body).posts.find((post) => {
                        return standardizeName(post.title, true) === standardizeName(player, true);
                    });
                    resolve(matchItem ? matchItem.id : null)
                })
            }
        })
    })
}

getPlayerId("A'Ja Wilson")

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