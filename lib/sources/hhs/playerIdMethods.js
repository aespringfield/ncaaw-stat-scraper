const fs = require('fs');
const request = require('request');
const { cacheIsExpired } = require('../../utils/cachingMethods');
const CACHED_PLAYERS_PATH = __dirname + '/cachedPlayers.json';
const CACHED_SEARCH_JSON_PATH = __dirname + '/cachedSearchJSON.json';
const SEARCH_JSON_CACHE_VALID_HOURS = 24;
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

const normalizeName = (name) => {
    return name.replace(/\’/g, "'").trim();
}

const findIdInSearchJSON = (name, searchJSONArray) => {
    const nameToMatch = normalizeName(name);
    const playerEntry = searchJSONArray.find((item) => {
        return item.match(new RegExp(nameToMatch, 'i'))
    })
    
    if (!playerEntry) {
        console.log('No entry found for', name);
        return;
    }

    return playerEntry.match(/^(?<id>\S.*)ncaa/).groups.id;
}

// Check cache first to see if it's current, or make request & update cache if it's not
const getSearchJSON = () => {
    return new Promise((resolve) => {
        fs.readFile(CACHED_SEARCH_JSON_PATH, 'utf8', (err, contents) => {
            const cache = contents ? JSON.parse(contents) : contents;

            if (cache && !cacheIsExpired(cache, SEARCH_JSON_CACHE_VALID_HOURS)) {
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
    return (player) => {
        switch(player) {
            // These players may collide with same-named player
            // (or pre-transfer page for same player)
            case 'Courtney Walker':
                return '11e8e6b3-ab41-f098';
            case 'Brittney Martin':
                return '11e8e6b0-ec5d-541c';
            case 'Niya Johnson':
                return '11e8e6a8-c30d-a0d8';
            case 'Jordan Jones':
                return '11e8e6b3-aa15-4d28';
            case 'Alexis Jones':
                return '11e8e1e2-dfb7-e9e8';
            case 'Jazmine Jones':
                return '11e8e154-8b6b-6344';
            case 'Mariella Fasoula':
                return '11e8e35d-aa5b-08bc';
            case 'Natasha Mack':
                return '11e9ffdc4a79e764';    
            default:
                return playersHash[player]
        }
    };
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

getSearchJSON().then((arr) => {
    findIdInSearchJSON('Michaela Onyenwere', arr)
})

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

module.exports = { getPlayerIdFinder, normalizeName };
