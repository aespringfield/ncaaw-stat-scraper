const fs = require('fs');
const _ = require('lodash');
const { getSheets, getSheetName, listHeadingsAndPlayers, setPlayerData, listHeadingsAndPlayersByYear, authorize } = require('./sheetsMethods');
const config = require('./config');
const WNBA_STATS = require('./wnbaStats')
const NCAA_STATS = require('./ncaaStats')
const HS_STATS = require('./highSchoolStats')
const SCRAPER_METHODS = {
    NCAA: require(`./sources/ncaa/scraperMethods`).scrape,
    HHS: require(`./sources/hhs/scraperMethods`).scrape,
    WNBA: require(`./sources/wnba/scraperMethods`).scrape,
    HG: require('./sources/hg/scraperMethods').scrape
};
const STAT_INFO = require('./statInfo');

function populateFrom(source) {
    const scrapeMethod = SCRAPER_METHODS[source];
    const stats = statsToFetch(config.LEAGUE);

    readPlayers()
        // Players is an array of player names
        .then(({ players, playersByYear, headings }) => {
            playersByYear = playersByYear || { [config.STATS_YEAR]: players };
            console.log('player names:', playersByYear);
            // console.log(stats)
            const columns = buildRelevantColumns(headings);
            return runScraper(scrapeMethod, playersByYear, stats)
                // Players is an array of player objects with stats
                .then((players) => {
                    // console.log('players:', players)
                    const data = buildUpdateData(players, columns)
                    writeData(data);
                })
        });
}

function runScraper(scrapeMethod, playersByYear, statList) {
    return Object.keys(playersByYear).reduce((accumulatePlayers, year) => {
        return accumulatePlayers.then((accumulatedPlayers) => {
            console.log('year', year)
            return scrapeMethod(playersByYear[year], { statList, year })
                .then((players) => {
                    return accumulatedPlayers.concat(players);
                })
        })
    }, Promise.resolve([]))
}

function availableStats(statList, source) {
    return statList.filter((stat) => {
        return STAT_INFO[stat][source];
    });
}

function readPlayers() {
    console.log('in readPlayers')
    return new Promise((resolve, reject) => {
        fs.readFile(__dirname + '/credentials.json', (err, content) => {
            if (err) {
                console.log('Error loading client secret file:', err);
                reject();
            }
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), (auth) => {
                resolve(getSheets(auth));
            })
        })
    }).then((sheets) => {
        let yearOffset;

        if (config.STATS_YEAR === 'ROOKIE') {
            yearOffset = 0;
        } else if (config.STATS_YEAR === 'SOPHOMORE') {
            yearOffset = 1;
        } else if (config.STATS_YEAR === 'TWO YEAR VET') {
            yearOffset = 2;
        } else if (config.STATS_YEAR === 'THREE YEAR VET') {
            yearOffset = 3;
        } else {
            yearOffset = 0;
        }

        if (config.STATS_YEAR === 'ROOKIE' || config.STATS_YEAR === 'SOPHOMORE' || config.STATS_YEAR === 'TWO YEAR VET' || config.STATS_YEAR === 'THREE YEAR VET') {
            return listHeadingsAndPlayersByYear(sheets, { yearOffset });
        } else {
            return listHeadingsAndPlayers(sheets);
        }
    });
}

function buildRelevantColumns(headings) {
    return headings
        .map((heading, index) => {
            return {
                heading,
                statName: statNameForHeading(heading),
                alphaColumn: convertIndexToColumn(index)
            };
        })
        // Only take the columns that are in stats to fetch
        .filter((column) => {
            return column.statName;
        });
}

function writeData(data) {
    // Single update
    if (data.length === 1) {
        const { range, ...resource } = data[0]
        callSheetMethod(setPlayerData, 'update', { range, resource, valueInputOption: 'USER_ENTERED' })
    } else {
    // Batch update
        callSheetMethod(setPlayerData, 'batchUpdate', {
            resource: {
                data,
                valueInputOption: 'USER_ENTERED'
            }
        });
    }
}

function buildUpdateData(players, columns) {
    const numPlayers = players.length;
    // Ranges is an array of groups of columns
    const ranges = sortColumnsIntoRanges(columns);
    return ranges.map((range) => {
        const rangeString = buildRangeString(range, numPlayers, getSheetName());
        const values = buildValues(players, range);
        return {  majorDimension: 'COLUMNS', range: rangeString, values };
    })
}

function buildValues(players, columns) {
    return columns.map((column) => {
        return [column.heading].concat(
            players.map((player) => {
                return player[column.statName] || null;
            })
        );
    });
}

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

function buildRangeString(range, numPlayers, sheetName) {
    return `${sheetName}!${range[0].alphaColumn}1:${range[range.length - 1].alphaColumn}${numPlayers + 1}`;
}

function getAnnaColumnName(statName) {
    return STAT_INFO[statName]['ANNA_COLUMN_NAME'];
}

function statNameForHeading(heading) {
    return statsToFetch(config.LEAGUE).find((statName) => {
        return heading === getAnnaColumnName(statName);
    });
}

function callSheetMethod(sheetMethod, ...args) {
    fs.readFile(__dirname + '/credentials.json', (err, content) => {
        if (err) {
            console.log(`Error calling sheet method ${sheetMethod}: ${err}`);
        } else {
            authorize(JSON.parse(content), (auth) => {
                const sheets = getSheets(auth);
                const sheetId = process.env.SENIORS_SHEET_ID;
                sheetMethod(sheets, sheetId, ...args);
            });
        }
    });
}

function statsToFetch(league) {
    switch(league) {
        case 'WNBA':
            return WNBA_STATS;
        case 'HS':
            return HS_STATS;
        default:
            return availableStats(NCAA_STATS, config.SOURCE);
    }
}

function filterForActive(players) {
    return players.filter((player) => {
        return Object.keys(player).length > 1;
    }).map((player) => player.name)
}

module.exports = { populateFrom };