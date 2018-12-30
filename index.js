const fs = require('fs');
const _ = require('lodash');

const { getSheets, listPlayers, setPlayerData, authorize } = require('./sheetsMethods');
const { getStatFor } = require('./scraperMethods');

const STAT_INFO = require('./statInfo');
const STATS_TO_FETCH = require('./statsToFetch');
const { grabbedData } = require('./grabbedData');



readPlayers().then((players) => {
    addStatsToPlayers(players, STATS_TO_FETCH)
    .then((players) => {
        console.log('players:', players)
        writePlayers(players, STAT_INFO);
    })
})

// writePlayers(grabbedData, STAT_INFO);

function readPlayers() {
    return new Promise((resolve, reject) => {
        fs.readFile('credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), (auth) => {
                const sheets = getSheets(auth);
                resolve(listPlayers(sheets));
            })
        })
    });
}

function writePlayers(players, stats) {
    const { range, resource } = buildSheetValues(players, stats);
    fs.readFile('credentials.json', (err, content) => {
        authorize(JSON.parse(content), (auth) => {
            const sheets = getSheets(auth);
            const sheetId = process.env.SENIORS_SHEET_ID;
            setPlayerData(sheets, sheetId, range, resource);
        });
    });
}

function addStatsToPlayers(players, stats) {
    return new Promise((resolve, reject) => {
        const { NAME: parentStat, MAX_PAGES, SUBSTATS } = stats[0];
        resolve(addStatToPlayers(players, parentStat, MAX_PAGES, SUBSTATS));
    }).then((players) => {
        const statsLeft = stats.slice(1);
        return statsLeft.length > 0 ? addStatsToPlayers(players, statsLeft) : players;
    });
}

function addStatToPlayers(players, parentStat, maxPages, substats) {
    return new Promise((resolve, reject) => {
        console.log('Stat:', parentStat);
        getStatFor(STAT_INFO[parentStat].ROUTE_NUMBER, maxPages).then((responsePlayers, error) => {
            const newPlayers = players.map((player) => {
                return responsePlayers.reduce((newPlayer, responsePlayer) => {
                    if (responsePlayer.Name.trim() === player.name) {
                        const stats = substats ? substats : [parentStat];
                        stats.forEach((stat) => {
                            newPlayer[stat] = responsePlayer[STAT_INFO[stat].STAT_ABBREV];
                        });
                    }
                    return newPlayer;
                }, {...player});
            });
            resolve(newPlayers);
        })
        .catch((error) => {
            console.log('error', error);
            resolve(addStatToPlayers(players, statName, maxPages))
            // reject(error);
        });
    });
}

function buildSheetValues(players, statsInfo) {
    const sortedStats = Object.entries(statsInfo)
    .filter(([statName, statInfo]) => {
        return statInfo.ANNA_COLUMN;
    })
    .sort(([statNameA, statInfoA], [statNameB, statInfoB]) => {
        return statInfoA.ANNA_COLUMN < statInfoB.ANNA_COLUMN ? -1 : 1;
    });

    const values = sortedStats.map(([statName, statInfo]) => {
        return [statInfo.ANNA_COLUMN_NAME].concat(
            players.map((player) => {
                return player[statName] || null;
            })
        );
    });
    return {
        range: `Sheet1!${sortedStats[0][1].ANNA_COLUMN}1:${_.last(sortedStats)[1].ANNA_COLUMN}${players.length + 1}`,
        resource: {
            "majorDimension": "COLUMNS",
            "values": values
        }
    };
}