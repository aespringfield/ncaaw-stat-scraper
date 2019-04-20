const request = require('request');
const config = require('../../config');
const { getPlayerIdFinder } = require('./playerIdMethods')
const STAT_INFO = require('../../statInfo');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const jQuery = require('jquery');
require('dotenv').config();

const getSuffixForYear = (year) => {
    return process.env[`${year}_HHS_URI_SUFFIX`];
}

const getSuffixForPlayer = (name) => {
    switch(name) {
        case 'Diamond DeShields':
            return process.env['2017_HHS_URI_SUFFIX'];
        case 'Paris Kea':
            return process.env.KEA_URI_SUFFIX;
        case 'Whitney Knight':
            return process.env['2017_HHS_URI_SUFFIX'];
        default:
            return getSuffixForYear(config.YEAR);
    }
}

const getStatsFor = (name, id, stats) => {
    if (!id) {
        console.log('No id for', name)
        return Promise.resolve({});
    }

    let suffix = getSuffixForPlayer(name);

    return new Promise((resolve) => {
        request({
            method: 'GET',
            uri: `${process.env.HHS_PLAYER_BASE_URI}${id}-${suffix}`,
            forever: true
        }, (error, response, body) => {
            if (error) {
                console.log(`Problem getting stats for ${name} at ${process.env.HHS_PLAYER_BASE_URI}${id}-${suffix}`)
                console.log(error)
            }

            console.log(`Scraping stats for ${name}`);
            let newBody = body.split(/<body>|<\/body>/);
            let html = newBody[1] + newBody[2];
            // html = html.replace(/<script.*<\/script>/, '');
            const dom = new JSDOM(html);
            const statObj = stats.reduce((memo, stat) => {
                let statInfo = STAT_INFO[stat].HHS;
                let nextNode = jQuery(dom.window)(`td:contains("${statInfo.LABEL}")${statInfo.NOT_INCLUDE ? `:not(:contains("${statInfo.NOT_INCLUDE}"))` : ''}:not(".visible-xs")`).first().next();
                let statText = nextNode.hasClass('visible-xs') ? nextNode.next().text() : nextNode.text();
                memo[stat] = statText;
                return memo;
            }, {});
            resolve(statObj);
        });
    })
}

const addStatsToPlayer = (player, id, statList) => {
    return getStatsFor(player.name, id, statList).then((playerStats) => {
        return { ...player, ...playerStats };
    });
}

const scrape = (players, { statList }) => {
    return getPlayerIdFinder(players).then((playerIdFinder) => {
        return Promise.all(players.map((player) => {
            return addStatsToPlayer({ name: player }, playerIdFinder(player), statList);
        }));
    })
}

module.exports = { scrape };