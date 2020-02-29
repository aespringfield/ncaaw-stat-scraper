const request = require('request');
const { getPlayerIds } = require('./playerIdMethods');
const { putInBatches } = require('../../utils/scraperHelpers');
const { cachePlayerStats, getStatsFromCache, getCachedPlayerStatsPath } = require('../../utils/cachingMethods');
const config = require('../../config');
require('dotenv').config();
const STAT_INFO = require('../../statInfo');

const getStatsDir = () => {
    return config.STATS_YEAR === 'ROOKIE'
        ? `${__dirname}/cachedPlayerStats`
        : `${__dirname}/cachedPlayerStats_${config.STATS_YEAR.toLowerCase()}`
}

const retrieveStats = (playerId, playerName, stats, opts) => {
    if (!playerId) {
        return Promise.resolve({});
    }

    const statsPath = getCachedPlayerStatsPath(playerName, getStatsDir());

    return getStatsFromCache(
        playerName,
        stats,
        statsPath,
        24*100,
        false
    ).then((cachedStats) => {
        if (cachedStats) {
            console.log('getting stats from cache for', playerName)
            return cachedStats;
        } else {
            console.log('scraping', opts.type.toLowerCase(), 'stats for', playerName);
            return scrapeStats(playerId, opts)
                .then((scrapedStats) => {
                    if (!scrapedStats) {
                        return {};
                    }
        
                    return stats.reduce((statsObj, stat) => {
                        const label = STAT_INFO[stat].WNBA.LABEL;
                        statsObj[stat] = scrapedStats[label];
                        return statsObj;
                    }, {});
                });
        }
    });
}

const scrapeStats = (playerId, opts) => {
    const type = opts.type === 'ADVANCED'
        ? 'Advanced'
        : 'Base'
    const year = opts.year || 2020;
    return new Promise((resolve) => {
        request({
            method: 'GET',
            forever: true,
            uri: `${process.env.WNBA_STATS_URI}?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=10&Location=&MeasureType=${type}&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerID=${playerId}&PlusMinus=N&Rank=N&Season=${year}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&Split=yoy&VsConference=&VsDivision=`,
            gzip: true,
            headers: {
                'Connection': 'keep-alive',
                'Accept': 'application/json, text/plain, */*',
                'x-nba-stats-token': 'true',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
                'x-nba-stats-origin': 'stats',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Referer': `${process.env.WNBA_STATS_PLAYER_URI}/${playerId}/`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        }, (error, response, body) => {
            if(error) {
                console.log(error);
            }

            const json = JSON.parse(body);

            const byYearPlayerDashboard = json.resultSets[1];
            const headers = byYearPlayerDashboard.headers;
            const rowSets = byYearPlayerDashboard.rowSet;
            const stats = rowSets.map((rowSet) => {
                return rowSet.reduce((rowObj, item, i) => {
                    rowObj[headers[i]] = item;
                    return rowObj;
                }, {});
            })
            const statsForYear = stats.filter((statSet) => {
                return statSet.GROUP_VALUE === year.toString();
            })

            resolve(
                statsForYear.length === 1
                ? statsForYear[0]
                : statsForYear.find((statSet) => statSet.TEAM_ABBREVIATION === 'TOT')
            );
        });
    })
}

const sortStatsByType = (stats) => {
    const basicStats = stats.filter((stat) => {
        return STAT_INFO[stat].WNBA.TYPE === 'BASIC';
    });
    const advancedStats = stats.filter((stat) => {
        return STAT_INFO[stat].WNBA.TYPE === 'ADVANCED';
    });

    return { basicStats, advancedStats };
}

const getStatsFor = (name, id, year, stats) => {
    const { basicStats: basicStatList, advancedStats: advancedStatList } = sortStatsByType(stats);

    return Promise.all([
        retrieveStats(id, name, advancedStatList, { year, type: 'ADVANCED' }),
        retrieveStats(id, name, basicStatList, { year, type: 'BASIC' })
    ]).then(([advancedStats, basicStats]) => {
        const allStats = { ...advancedStats, ...basicStats };
        cachePlayerStats(name, allStats, getCachedPlayerStatsPath(name, getStatsDir()));

        return { name, ...allStats };
    });
}

const getStatsForPlayers = (players, year, stats) => {
    const batchedPlayers = putInBatches(players, 2);
    
    return batchedPlayers.reduce((promiseChain, batch) => {
        return promiseChain.then((batchWithStatsSoFar) => {
            return getPlayerIds(batch).then((playerIds) => {
                return Promise.all(batch.map((player) => {
                    return getStatsFor(player, playerIds[player], year, stats);
                }))
            }).then((newBatchWithStats) => {
                return batchWithStatsSoFar.concat(newBatchWithStats);
            }).then((batchedStats) => {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve(batchedStats);
                    }, 9000);
                })
            });
        });
    }, Promise.resolve([]));
}

const scrape = (players, { statList, year }) => {
    return getStatsForPlayers(players, year, statList);
}

module.exports = { scrape };
