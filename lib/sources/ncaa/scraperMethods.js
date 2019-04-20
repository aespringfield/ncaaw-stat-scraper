const request = require('request');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const STAT_INFO = require('../../statInfo');
const BASE_ROUTE = 'https://www.ncaa.com/stats/basketball-women/d1/current/individual';

function scrape(players, { statList }) {
    return addStatsToPlayers(players.map(player => { name: player }), transformStats(statList));
}

function transformStats(statList) {
    const { standalones, substats } = statList.reduce((memo, stat) => {
        let statInfo = STAT_INFO[stat].NCAA;
        let parentStat = statInfo.PARENT_STAT;
        if (parentStat) {
            if (memo.substats[parentStat]) {
                memo.substats[parentStat].SUBSTATS.push(stat);
            } else {
                memo.substats[parentStat] = {
                    NAME: parentStat,
                    SUBSTATS: [stat],
                    ...(STAT_INFO[parentStat].NCAA.MAX_PAGES && { MAX_PAGES: STAT_INFO[parentStat].NCAA.MAX_PAGES })
                };
            }
        } else {
            memo.standalones.push({
                NAME: stat,
                ...(statInfo.MAX_PAGES && { MAX_PAGES: statInfo.MAX_PAGES })
            });
        }
        return memo;
    }, { standalones: [], substats: {} });

    return standalones.concat(Object.values(substats).map((value) => value));
}

function addStatsToPlayers(players, stats) {
    const { NAME: parentStat, MAX_PAGES, SUBSTATS } = stats[0];
    return addStatToPlayers(players, parentStat, MAX_PAGES, SUBSTATS).then((players) => {
        const statsLeft = stats.slice(1);
        return statsLeft.length > 0 ? addStatsToPlayers(players, statsLeft) : players;
    });
}

function addStatToPlayers(players, parentStat, maxPages, substats) {
    console.log('Stat:', parentStat);
    return getStatFor(STAT_INFO[parentStat].NCAA.ROUTE_NUMBER, maxPages)
        .then((responsePlayers, error) => {
            const newPlayers = players.map((player) => {
                return responsePlayers.reduce((newPlayer, responsePlayer) => {
                    if (responsePlayer.Name.trim() === player.name) {
                        const stats = substats ? substats : [parentStat];
                        stats.forEach((stat) => {
                            let statInfo = STAT_INFO[stat].NCAA;
                            newPlayer[stat] = responsePlayer[statInfo.LABEL];
                        });
                    }
                    return newPlayer;
                }, {...player});
            });
            return newPlayers;
        })
        .catch((error) => {
            console.log('error', error);
            // resolve(addStatToPlayers(players, statName, maxPages))
            // reject(error);
        });
}

function getStatFor(routeNumber, maxPages=5, players=[], page=null) {
    return new Promise((resolve, reject) => {
        console.log('running for page', page + 1)
        request({
            method: 'GET',
            uri: `${BASE_ROUTE}/${routeNumber}/${ page ? `p${page}` : '' }`,
            forever: true
        }, (error, response, body) => {
            if (error) {
                console.log('error:', error);
                resolve(players);
            }
            let newBody = body.split(/<head>|<\/head>/);
            let html = newBody[0] + newBody[2];
            const dom = new JSDOM(html);
            const newPlayers = players.concat(buildObjects(getRows(dom.window.document)));
            console.log('length', newPlayers.length);
            resolve({newPlayers, maxPages, routeNumber, page: page ? page + 1 : 1});
        });
    })
    .then(({ newPlayers, maxPages, routeNumber, page }) => {
        return (page > maxPages ? players : getStatFor(routeNumber, maxPages, newPlayers, page))
    });
}

function getRows(page) {
    const headRow = page.querySelector('.block-stats__stats-table thead tr');
    const bodyRows = page.querySelectorAll('.block-stats__stats-table tbody tr');
    return { headRow, bodyRows };
}

function buildObjects({ headRow, bodyRows }) {
    const headCellsArray = Array.from(headRow.querySelectorAll('th'));
    const bodyRowsArray = Array.from(bodyRows);
    return bodyRowsArray.map((bodyRow) => {
        const bodyCellsArray = Array.from(bodyRow.querySelectorAll('td'));
        return headCellsArray.reduce((memo, headCell, i) => {
            memo[headCell.textContent] = bodyCellsArray[i].textContent;
            return memo;
        }, {});
    });
}

module.exports = { scrape };