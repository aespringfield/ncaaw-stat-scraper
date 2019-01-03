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

populateFrom(config.SOURCE);

function populateFrom(source) {
    const scrapeMethod = SCRAPER_METHODS[source];
    const stats = availableStats(STATS_TO_FETCH);

    readPlayers()
        .then((players) => {
            return scrapeMethod(players, stats);
        })
        .then((players) => {
            console.log('players:', players)
            writePlayers(players, stats);
        })
}

// writePlayers(grabbedData, STAT_INFO);

function availableStats(statList, source) {
    return statList.filter((stat) => {
        return STAT_INFO[stat][source];
    });
}

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

function buildSheetValues(players, statsFound) {
    const sortedStats = statsFound.map((stat) => {
        return {
            name: stat,
            ...STAT_INFO[stat]
        };
    })
    .filter((stat) => {
        return stat.ANNA_COLUMN;
    })
    .sort((statA, statB) => {
        return statA.ANNA_COLUMN < statB.ANNA_COLUMN ? -1 : 1;
    });

    const values = sortedStats.map((stat) => {
        return [stat.ANNA_COLUMN_NAME].concat(
            players.map((player) => {
                return player[stat.name] || null;
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