const request = require('request');
const { getPlayerId, getSearchJSON } = require('./playerIdMethods')
const STAT_INFO = require('../../statInfo');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
require('dotenv').config();

const getStatsFor = (name, stats) => {
    return getPlayerId(name).then((id) => {
        if (!id) {
            return;
        }

        console.log(`Getting stats for ${name}`)
        return new Promise((resolve) => {
            request({
                method: 'GET',
                uri: `${process.env.HHS_PLAYER_BASE_URI}${id}-${process.env.HHS_URI_SUFFIX}`,
                forever: true
            }, (error, response, body) => {
                if (error) {
                    console.log(error)
                }

                let newBody = body.split(/<head>|<\/head>/);
                let html = newBody[0] + newBody[2];
                const dom = new JSDOM(html);
                const jQuery = require('jquery')(dom.window);
                const statObj = stats.reduce((memo, stat) => {
                    let statInfo = STAT_INFO[stat].HHS;
                    let nextNode = jQuery(`td:contains("${statInfo.LABEL}")${statInfo.NOT_INCLUDE ? `:not(:contains("${statInfo.NOT_INCLUDE}"))` : ''}:not(".visible-xs")`).first().next();
                    let statText = nextNode.hasClass('visible-xs') ? nextNode.next().text() : nextNode.text();
                    memo[stat] = statText;
                    return memo;
                }, {});
                resolve(statObj);
            });
        })
    });
}

const addStatsToPlayer = (player, statList) => {
    return getStatsFor(player.name, statList).then((playerStats) => {
        return { ...player, ...playerStats };
    });
}

const scrape = (players, statList) => {
    // Because promises will resolve independently, get & cache
    // search JSON once rather than every time
    return getSearchJSON().then(() => {
        return Promise.all(players.map((player) => {
            return addStatsToPlayer(player, statList);
        }));
    });
}

module.exports = { scrape };