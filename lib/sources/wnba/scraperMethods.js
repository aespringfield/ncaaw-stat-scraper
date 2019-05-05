const request = require('request');
const { getPlayerIds } = require('./playerIdMethods');
require('dotenv').config();

const retrieveAdvancedStat = (statKey, multiplyBy100=false) => {
    return (statsJson, year) => {
        const stats = statsJson['advanced']
            .find((seasonTypeHash) => {
                return seasonTypeHash['name'] === 'RegularSeason';
            })['rows']
            .find((seasonHash) => {
                return seasonHash['SEASON_ID'].slice(-4) === year;
            })
        return stats
            ? stats[statKey] * (multiplyBy100 ? 100 : 1)
            : null;
    }
}

const retrieveBasicStat = (statKey, multiplyBy100=false) => {
    return (statsJson, year) => {
        const stats = statsJson['sas']
            .find((seasonHash) => {
                return seasonHash['val'] === year && seasonHash['seasontype'] === '02' // regular season
            })
        return stats
            ? stats[statKey] * (multiplyBy100 ? 100 : 1)
            : null;
    }
}

const STATS_FUNCTIONS = {
    "WNBA_PIE": {
        retrievalFunction: retrieveAdvancedStat('PIE', true)
    },
    "WNBA_MPG": {
        retrievalFunction: retrieveBasicStat('min')
    },
    "WNBA_PPG": {
        retrievalFunction: retrieveBasicStat('pts')
    },
    "WNBA_3%": {
        retrievalFunction: retrieveBasicStat('tpp')
    },
    "WNBA_EFG%": {
        retrievalFunction: retrieveAdvancedStat('EFG_PCT')
    },
    "WNBA_TS%": {
        retrievalFunction: retrieveAdvancedStat('TS_PCT')
    },
    "WNBA_REB%": {
        retrievalFunction: retrieveAdvancedStat('REB_PCT')
    },
    "WNBA_AST_TO": {
        retrievalFunction: retrieveAdvancedStat('AST_TO')
    },
    "WNBA_USAGE%": {
        retrievalFunction: retrieveAdvancedStat('USAGE_PCT')
    },
    "WNBA_STEALS_PER_GAME": {
        retrievalFunction: retrieveBasicStat('stl')
    },
    "WNBA_ASSISTS_PER_GAME": {
        retrievalFunction: retrieveBasicStat('ast')
    },
    "WNBA_REBOUNDS_PER_GAME": {
        retrievalFunction: retrieveBasicStat('reb')
    },
    "WNBA_BLOCKS_PER_GAME": {
        retrievalFunction: retrieveBasicStat('blk')
    },
    "WNBA_TURNOVERS_PER_GAME": {
        retrievalFunction: retrieveBasicStat('tov')
    },
    "WNBA_GAMES_PLAYED": {
        retrievalFunction: retrieveBasicStat('gp')
    }
};

const getStatsFor = (name, id, year, stats) => {
    return new Promise((resolve) => {
        if (!id) {
            resolve({ name });
        } else {
            request({
                method: 'GET',
                uri: `${process.env.WNBA_PLAYER_ENDPOINT_BASE_URI}/${id}`,
                forever: true
            }, (err, response, body) => {
                console.log(`Retrieving stats for ${name}`);

                if (err || !JSON.parse(body)) {
                    if (err) {
                        console.log('Error retrieving stats:', err)
                    } else {
                        console.log('No stats JSON returned')
                    }

                    resolve({ name })
                } else {
                    const statsHash = JSON.parse(body)['data'];

                    const statsObj = stats.reduce((memo, statName) => {
                        const retrievalFunction = STATS_FUNCTIONS[statName].retrievalFunction;
                        memo[statName] = retrievalFunction(statsHash, year);
                        return memo;
                    }, { name: name });

                    resolve(statsObj);
                }
            });
        }
    });
}

const getStatsForPlayers = (players, year, stats) => {
    return getPlayerIds(players).then((playerIds) => {
        return Promise.all(players.map((player) => {
            return getStatsFor(player, playerIds[player], year, stats);
        }));
    })
}

const scrape = (players, { statList, year }) => {
    return getStatsForPlayers(players, year, statList);
}

module.exports = { scrape };
