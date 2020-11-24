const request = require('request');
const STAT_INFO = require('../../statInfo');
const JSDOM = require('jsdom').JSDOM;
const jQuery = require('jquery');
const fs = require('fs');
const { cachePlayerStats, getCachedPlayerStats, getCachedPlayerStatsPath, standardizeName } = require('../../utils/cachingMethods');

require('dotenv').config();

const getIndexForColumn = (label, headerCells) => {
    return Array.from(headerCells).findIndex((td) => {
        return td.textContent.trim() === label
    })
}

const getStatsFromCache = (name, stats) => {
    return getCachedPlayerStats(name, getCachedPlayerStatsPath(name, `${__dirname}/cachedPlayerStats`), 100000).then((cachedPlayerStats) => {
        if (!cachedPlayerStats) {
            return null;
        }

        const statsObj = {};
        let statMissingFromCache = false;
        stats.forEach((stat) => {
            statsObj[stat] = cachedPlayerStats[stat];
        });
          
        console.log(`Got player stats for ${name} from cache`);
        return statMissingFromCache ? null : statsObj;
    });
}

const getDom = (year) => {
    return new Promise((resolve) => {
        request({
            method: 'GET',
            uri: `${process.env.HG_BASE_URI}/${year}`,
            forever: true
        }, (error, response, body) => {
            if (error) {
                console.log('Problem getting high school rankings')
                throw Error(error)
            }
            // fs.writeFile('./bloop.html', body, () => {
            //     console.log('bleep')
            // })

            resolve(new JSDOM(body));
        })
    })
}

const scrapeStatsFor = (players, statList, year, scrapedDom = null) => {
    return new Promise((resolve) => {
        if (scrapedDom) {
            resolve(scrapedDom)
        } else {
            resolve(getDom(year))
            // fs.readFile('./blop.txt', 'utf8', (err, stuff) => {
            //     // console.log(stuff);
            //     resolve(new JSDOM(stuff))
            // })
        }
    }).then((dom) => {
        // const jQueryHeaderCells = jQuery(dom.window)('table.tablehead tr.colhead td').toArray()
        const table = dom.window.document.querySelector('table.tablehead')
        const headerCells = table.querySelector('tr.colhead').querySelectorAll('td')
        const nameColumnIndex = getIndexForColumn('NAME', headerCells)
        const tableRows = Array.from(table.querySelectorAll('tr'))
        const tableBodyRows = tableRows.slice(2, tableRows.length)
        const playersWithStats = []
        players.forEach((playerName) => {
            const statObj = {};
            const playerRow = tableBodyRows.find((row) => {
                const rowCells = Array.from(row.querySelectorAll('td'))
                return standardizeName(rowCells[nameColumnIndex].textContent.trim(), true) === standardizeName(playerName, true)
            })
            if (!playerRow) {
                console.log('No row found for player', playerName);
                playersWithStats.push({ name: playerName })
                return;
            }

            const playerRowCells = Array.from(playerRow.querySelectorAll('td'))
            statList.forEach((statName) => {
                const statColumnIndex = getIndexForColumn(STAT_INFO[statName].HG.LABEL, headerCells)
                const statValue = playerRowCells[statColumnIndex].textContent.trim();
                statObj[statName] = statValue;
            })
            cachePlayerStats(playerName, statObj, getCachedPlayerStatsPath(playerName, `${__dirname}/cachedPlayerStats`))
            playersWithStats.push({ name: playerName, ...statObj })
        })
        return playersWithStats
    })
}

const scrape = (players, { statList, year }) => {
    return Promise.all(
        players.map((playerName) => { 
            return getStatsFromCache(playerName, statList).then((cachedStats) => {
                const statsObj = cachedStats || {};
                return { name: playerName, ...statsObj }
            })
        })
    ).then((playerObjects) => {
        console.log('playerObjects', playerObjects)
        const allStatsAccountedFor = playerObjects.reduce((result, playerObject) => {
            const playerObjIncludesAllStats = statList.reduce((includesAll, statName) => {
                return includesAll && (Object.keys(playerObject)).includes(statName)
            }, false)

            return playerObjIncludesAllStats || result
        }, false)
            
        if (allStatsAccountedFor) {
            return playerObjects
        } else {
            return scrapeStatsFor(players, statList, year)
        }
    })
}

module.exports = { scrape };