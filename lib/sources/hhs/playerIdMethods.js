const fs = require('fs');
const request = require('request');
const CACHED_PLAYERS_PATH = __dirname + '/cachedPlayers.json';
const CACHED_SEARCH_JSON_PATH = __dirname + '/cachedSearchJSON.json';
const HOURS_BEFORE_RECACHE_SEARCH_JSON = 24;
require('dotenv').config();

const cacheSearchJSON = (searchJSONArray) => {
    fs.writeFile(CACHED_SEARCH_JSON_PATH, JSON.stringify({ date: new Date(), searchJSONArray }), (err) => {
        if (err) {
            console.log('Error caching search JSON:', err);
        }

        console.log('Cached search JSON updated');
    })
}

const cachePlayersHash = (playersHash) => {
    fs.writeFile(CACHED_PLAYERS_PATH, JSON.stringify(playersHash), (err) => {
        if (err) {
            console.log('Error caching players:', err);
        }

        console.log('Cached players updated');
    })
}

const requestSearchJSON = () => {
    return new Promise((resolve) => {
        request({
            method: 'GET',
            uri: process.env.SEARCH_JSON_URI,
            forever: true
        }, (error, response, body) => {
            if (error) {
                console.log('Error in request:', error);
            }

            if (body) {
                const searchJSONArray = JSON.parse(body);
                resolve(searchJSONArray);
            } 
        })
    });
}

const findIdInSearchJSON = (name, searchJSONArray) => {
    const playerEntry = searchJSONArray.find((item) => {
        return name === item.slice(16)
    })
    
    if (!playerEntry) {
        console.log('No entry found for', name);
        return;
    }

    return playerEntry.slice(0, 16);
}

// Check cache first to see if it's current, or make request & update cache if it's not
const getSearchJSON = () => {
    return new Promise((resolve) => {
        fs.readFile(CACHED_SEARCH_JSON_PATH, (err, contents) => {
            const cache = contents ? JSON.parse(contents) : contents;

            if (cache && (Date.now().valueOf() - (new Date(cache.date)).valueOf() < HOURS_BEFORE_RECACHE_SEARCH_JSON * 3600000)) {
                console.log('Got search JSON from cache');
                resolve(cache.searchJSONArray);
            } else {
                requestSearchJSON().then((searchJSONArray) => {
                    cacheSearchJSON(searchJSONArray);
                    resolve(searchJSONArray);
                })
            }
        })
    });
}

const getPlayersHash = () => {
    return new Promise((resolve) => {
        fs.readFile(CACHED_PLAYERS_PATH, (err, contents) => {
            resolve(contents ? JSON.parse(contents) : {});
        });
    });
}

const setupGetPlayerId = (playersHash) => {
    return (player) => playersHash[player];
}

const addPlayersToCache = (players, playersHash) => {
    return getSearchJSON()
        .then((searchJSONArray) => {
            const newPlayersHash = players.reduce((newPlayersHash, player) => {
                return { ...newPlayersHash, [player]: findIdInSearchJSON(player, searchJSONArray) };
            }, {});
            cachePlayersHash(newPlayersHash);
            return newPlayersHash;
        });
}

const getPlayerIdFinder = (players) => {
    // get cached players
    return getPlayersHash()
        .then((playersHash) => {
            const hasUncachedPlayers = players.find((player) => {
                return !playersHash[player];
            });

            return hasUncachedPlayers ? addPlayersToCache(players, playersHash) : Promise.resolve(playersHash);
        })
        .then((playersHash) => {
            return setupGetPlayerId(playersHash);
        })
};

// getPlayerId('Megan Gustafson').then((id) => console.log(id))

module.exports = { getPlayerIdFinder };
