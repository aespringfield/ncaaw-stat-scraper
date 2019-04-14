const request = require('request');
const { getPlayerIds } = require('./playerIdMethods');
require('dotenv').config();

const retrieveAdvancedStat = (statKey, multiplyBy100=false) => {
    return (statsJson, year) => {
        return statsJson['advanced']
            .find((seasonTypeHash) => {
                return seasonTypeHash['name'] === 'RegularSeason';
            })['rows']
            .find((seasonHash) => {
                return seasonHash['SEASON_ID'].slice(-4) === year;
            })[statKey] * (multiplyBy100 ? 100 : 1);
    }
}

const retrieveBasicStat = (statKey, multiplyBy100=false) => {
    return (statsJson, year) => {
        return statsJson['sas']
            .find((seasonHash) => {
                return seasonHash['val'] === year && seasonHash['seasontype'] === '02' // regular season
            })[statKey] * (multiplyBy100 ? 100 : 1);
    }
}

const STATS_TO_FETCH = [
    {
        anna_column_name: 'WNBA PIE',
        retrieval_function: retrieveAdvancedStat('PIE', true)
    },
    {
        anna_column_name: 'WNBA minutes per game',
        retrieval_function: retrieveBasicStat('min')
    },
    {
        anna_column_name: 'WNBA PPG',
        retrieval_function: retrieveBasicStat('pts')
    },
    {
        anna_column_name: 'WNBA 3P%',
        retrieval_function: retrieveBasicStat('tpp')
    },
    {
        anna_column_name: 'WNBA eFG%',
        retrieval_function: retrieveAdvancedStat('EFG_PCT')
    },
    {
        anna_column_name: 'WNBA TS%',
        retrieval_function: retrieveAdvancedStat('TS_PCT')
    },
    {
        anna_column_name: 'WNBA REB%',
        retrieval_function: retrieveAdvancedStat('REB_PCT')
    },
    {
        anna_column_name: 'WNBA AST/TO',
        retrieval_function: retrieveAdvancedStat('AST_TO')
    },
    {
        anna_column_name: 'WNBA usage %',
        retrieval_function: retrieveAdvancedStat('USAGE_PCT')
    }
]

const getStatsFor = (name, id, year, stats) => {
    return new Promise((resolve) => {
        request({
            method: 'GET',
            uri: `${process.env.WNBA_PLAYER_ENDPOINT_BASE_URI}/${id}`,
            forever: true
        }, (err, response, body) => {
            console.log(`Retrieving stats for ${name}`);

            const statsHash = JSON.parse(body)['data'];

            const statsObj = stats.reduce((memo, { anna_column_name, retrieval_function }) => {
                memo[anna_column_name] = retrieval_function(statsHash, year);
                return memo;
            }, { name: name });

            resolve(statsObj);
        });
    });
}

const getStatsForPlayers = (players, year, stats) => {
    return getPlayerIds(players).then((playerIds) => {
        return Promise.all(players.map((player) => {
            return getStatsFor(player, playerIds[player], year, stats);
        }));
    })
}

const scrape = (players, { year }) => {
    return getStatsForPlayers(players, year, STATS_TO_FETCH);
}

module.exports = { scrape };

// getStatsForPlayers(['Allisha Gray', 'Sue Bird', 'Kristi Toliver', 'Rebekkah Brunson', 'Liz Cambage'], '2018', STATS_TO_FETCH).then((playersWithStats) => {
//     console.log(playersWithStats);
// })

// getPlayerIds(['Allisha Gray', 'Liz Cambage'])
// .then((playerIds) => {
//     return getStatsFor('Allisha Gray', playerIds['Allisha Gray'], '2018', STATS_TO_FETCH)
// })
// .then((stats) => console.log(stats))
