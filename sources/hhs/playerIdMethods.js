const fs = require('fs');
const request = require('request');
const CACHED_PLAYERS_PATH = 'sources/hhs/cachedPlayers.json';
const CACHED_SEARCH_JSON_PATH = 'sources/hhs/cachedSearchJSON.json';
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

const addPlayerToCache = (players, name, id) => {
    fs.writeFile(CACHED_PLAYERS_PATH, JSON.stringify({ ...players, [name]: id }), (err) => {
        if (err) {
            console.log(err)
        }

        console.log(`Cache updated to include ${name}`);
    });
}

const getIdFromSearchJSON = (name) => {
    return getSearchJSON().then((searchJSONArray) => {
        return findIdInSearchJSON(name, searchJSONArray);
    });
}

const getPlayerId = (name) => {
    return new Promise((resolve) => {
        fs.readFile(CACHED_PLAYERS_PATH, (err, contents) => {
            const players = contents ? JSON.parse(contents) : {};
            if (players[name]) {
                resolve(players[name]);
            } else {
                getIdFromSearchJSON(name).then((id) => {
                    if (id) {
                        addPlayerToCache(players, name, id);
                    }

                    resolve(id);
                });
            }
        });
    });
}

// getPlayerId('Megan Gustafson').then((id) => console.log(id))

module.exports = { getPlayerId, getSearchJSON };
