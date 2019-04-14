const fs = require('fs');
const _ = require('lodash');
const { getSheets, getSheetName, listPlayers, listHeadingsAndPlayers, setPlayerData, batchSetPlayerData, authorize } = require('./sheetsMethods');
const config = require('./config');
const STATS_TO_FETCH = config.STATS_TO_FETCH;
const SCRAPER_METHODS = {
    NCAA: require(`./sources/ncaa/scraperMethods`).scrape,
    HHS: require(`./sources/hhs/scraperMethods`).scrape,
    WNBA: require(`./sources/wnba/scraperMethods`).scrape,
};
const STAT_INFO = require('./statInfo');

function populateFrom(source) {
    const scrapeMethod = SCRAPER_METHODS[source];
    const stats = availableStats(STATS_TO_FETCH, source);

    readPlayers()
        .then((players) => {
            return scrapeMethod(players, { statList: stats, year: config.year });
        })
        .then((players) => {
            console.log('players:', players)
            writePlayers(players, stats);
        })
}

function availableStats(statList, source) {
    return statList.filter((stat) => {
        return STAT_INFO[stat][source];
    });
}

function readPlayers() {
    return new Promise((resolve, reject) => {
        fs.readFile(__dirname + '/credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), (auth) => {
                const sheets = getSheets(auth);
                resolve(listPlayers(sheets));
            })
        })
    });
}

// Nearly duplicate, delete this or one above
function readStuff() {
    return new Promise((resolve, reject) => {
        fs.readFile(__dirname + '/credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), (auth) => {
                const sheets = getSheets(auth);
                resolve(listHeadingsAndPlayers(sheets));
            })
        
        })
    });
}

readStuff().then(({ headings, players }) => {
    const columns = headings
        .map((heading, index) => {
            return {
                heading,
                statName: statNameForColumn(column),
                alphaColumn: convertIndexToColumn(index)
            };
        })
        .filter((column) => {
            return column.statName;
        })

        scrapeMethod(players, { statList: STATS_TO_FETCH, year: config.year })
            .then((players) => {
                const numPlayers = players.length;
                const ranges = sortColumnsIntoRanges(columns);
                const valueRange = ranges.map((range) => {
                    return {
                        majorDimension: 'COLUMNS',
                        range: buildRangeString(range, numPlayers, getSheetName()),
                        values: range.map((column) => {
                            return [column.heading].concat(
                                players.map((player) => {
                                    return player[column.statName] || null;
                                })
                            );
                        })
                    }
                });

                batchSetPlayerData()

                return {
                    valueInputOption
                }

            });

    
    console.log(buildRangeStrings(columns, players, 'Borfo'))
})

function convertIndexToColumn(index, columnString='') {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const adjustedIndex = index + 1;
    const remainder = adjustedIndex % 26 > 0 ? adjustedIndex % 26 : 26;
    const newColumnString = alphabet[remainder - 1] + columnString;
    const dividend = (adjustedIndex - remainder)/26
    return dividend > 0 ? convertIndexToColumn(dividend - 1, newColumnString) : newColumnString;
}

function convertColumnToIndex(columnString, indexSoFar=0, multiplier=1) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const addToIndex = (1 + alphabet.findIndex((letter) => {
        return letter === columnString.slice(-1);
    })) * multiplier;
    const newIndex = indexSoFar + addToIndex;
    const restOfString = columnString.slice(0, -1);
    return restOfString.length > 0 ? convertColumnToIndex(restOfString, newIndex, multiplier * 26) : newIndex - 1;
}

function sortColumnsIntoRanges(columns) {
    const columnsWithIndex = columns.map((column) => {
        return { ...column, idx: convertColumnToIndex(column.alphaColumn) }
    });
    const sortedColumns = columnsWithIndex.sort((a, b) => {
        return a.idx < b.idx ? -1 : 1;
    });
    return sortedColumns.reduce((ranges, column) => {
        const lastRange = ranges[ranges.length - 1];
        if (lastRange && lastRange[lastRange.length - 1].idx + 1 === column.idx) {
            lastRange.push(column);
        } else {
            ranges.push([column]);
        }
        return ranges;
    }, []);
}

// [`${getSheetName()}!A1:AZ1`, `${getSheetName()}!A2:A55`]

function buildRangeString(range, numPlayers, sheetName) {
    return `${sheetName}!${range[0].alphaColumn}1:${range[range.length - 1].alphaColumn}${numPlayers + 1}`;
}

function buildRangeStrings(ranges, players, sheetName) {
    const numPlayers = players.length;
    return ranges.map((range) => {
        return buildRangeString(range, numPlayers, sheetName);
    }); 
}

function getAnnaColumnName(statName) {
    return STAT_INFO[statName]['ANNA_COLUMN_NAME'];
}

function statNameForColumn(column) {
    return STATS_TO_FETCH.find((statName) => {
        return column.heading === getAnnaColumnName(statName);
    });
}

function writePlayers(players, stats) {
    const { range, resource } = buildSheetValues(players, stats);
    fs.readFile(__dirname + '/credentials.json', (err, content) => {
        authorize(JSON.parse(content), (auth) => {
            const sheets = getSheets(auth);
            const sheetId = process.env.SENIORS_SHEET_ID;
            setPlayerData(sheets, sheetId, range, resource);
        });
    });
}

// Almost same as above, change or delete
function batchWritePlayers(players, stats) {
    const { range, resource } = buildSheetValues(players, stats);
    fs.readFile(__dirname + '/credentials.json', (err, content) => {
        authorize(JSON.parse(content), (auth) => {
            const sheets = getSheets(auth);
            const sheetId = process.env.SENIORS_SHEET_ID;
            batchSetPlayerData(sheets, sheetId, range, resource);
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
        range: `${getSheetName()}!${sortedStats[0].ANNA_COLUMN}1:${_.last(sortedStats).ANNA_COLUMN}${players.length + 1}`,
        resource: {
            "majorDimension": "COLUMNS",
            "values": values
        }
    };
}

module.exports = { populateFrom };