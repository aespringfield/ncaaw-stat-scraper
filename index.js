const fs = require('fs');
const _ = require('lodash');
const { getSheets, listPlayers, setPlayerData, authorize } = require('./sheetsMethods');
const config = require('./config');
const STATS_TO_FETCH = config.STATS_TO_FETCH;
const SCRAPER_METHODS = {
    NCAA: require(`./sources/ncaa/scraperMethods`).scrape,
    HHS: require(`./sources/hhs/scraperMethods`).scrape
};
// const { grabbedData } = require('./grabbedData');
const STAT_INFO = require('./statInfo');

populate(SCRAPER_METHODS[config.SOURCE]);

function populate(scraperMethod) {
    readPlayers()
        .then((players) => {
            return scraperMethod(players, STATS_TO_FETCH);
        })
        .then((players) => {
            console.log('players:', players)
            writePlayers(players, STAT_INFO);
        })
}

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