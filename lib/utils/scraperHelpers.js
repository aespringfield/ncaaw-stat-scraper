const request = require('request');
const { JSDOM } = require('jsdom');
const STAT_INFO = require('../statInfo');
const { cachePlayerStats, getCachedPlayerStats, getCachedPlayerStatsPath } = require('./cachingMethods');

const getStatsHtml = (name, uri, requestOpts = {}) => {
    return new Promise((resolve) => {
        request({
            method: 'GET',
            uri,
            forever: true,
            ...requestOpts
        }, (error, response, body) => {
            if (error) {
                console.log(`Problem getting stats for ${name}`)
                console.log(error)
            }

            console.log(`Scraping stats for ${name}`);
            if (!body) {
                console.log(`No body for ${name}`);
                resolve({})
            }
            const newBody = body.split(/<body>|<\/body>/);

            resolve(newBody[1]);
        });
    })
}

const scrapeStatsFromHtml = (stats, html, source, statTextGrabber) => {
    const dom = new JSDOM(html);
    console.log(html)
    return statObj = stats.reduce((memo, stat) => {
        let statInfo = STAT_INFO[stat][source];
        memo[stat] = statTextGrabber(dom, statInfo);
        return memo;
    }, {});
}

const putInBatches = (players, batchMaxSize) => {
    const batches = [];
    for (let i = batchMaxSize; i < players.length + batchMaxSize; i += batchMaxSize) {
        batches.push(players.slice(i - batchMaxSize, i));
    }

    return batches;
}

module.exports = {
    getStatsHtml,
    scrapeStatsFromHtml,
    putInBatches
}