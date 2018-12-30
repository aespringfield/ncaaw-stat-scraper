const request = require('request');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const BASE_ROUTE = 'https://www.ncaa.com/stats/basketball-women/d1/current/individual';

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

module.exports = { getStatFor };