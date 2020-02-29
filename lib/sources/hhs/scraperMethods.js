const request = require('request');
const fs = require('fs');
const config = require('../../config');
const { getPlayerIdFinder, normalizeName } = require('./playerIdMethods');
const { login } = require('./loginMethods');
const STAT_INFO = require('../../statInfo');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const jQuery = require('jquery');
const PromisePool = require('es6-promise-pool');
const { putInBatches } = require('../../utils/scraperHelpers');
const { cachePlayerStats, getCachedPlayerStats, getCachedPlayerStatsPath } = require('../../utils/cachingMethods');
require('request-to-curl');
require('dotenv').config();

login().then((jar) => console.log('yep'))

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
        case 'Aliyah Jeune':
            return process.env['2017_HHS_URI_SUFFIX'];
        case 'Aari McDonald':
            return process.env['2017_HHS_URI_SUFFIX'];
        case 'Mariane De Carvalho':
            return process.env['2020_NEW_URI_SUFFIX'];
        case 'Mariella Fasoula':
            return process.env['2020_NEW_URI_SUFFIX'];
        case 'Sara Scalia':
            return process.env['2023_HHS_URI_SUFFIX'];
        case 'Aliyah Boston':
            return process.env['2023_HHS_URI_SUFFIX'];
        case 'Rhyne Howard':
            return process.env['2020_NEW_URI_SUFFIX'];
        case 'Elissa Cunane':
            return process.env['2020_NEW_URI_SUFFIX'];
        case 'Ashley Joens':
            return process.env['2020_NEW_URI_SUFFIX'];
        case 'Christyn Williams':
            return process.env['2020_NEW_URI_SUFFIX'];
        case 'Nalyssa Smith':
            return process.env['2020_NEW_URI_SUFFIX'];
        default:
            return getSuffixForYear(config.DRAFT_YEAR);
    }
}

const getSessionIdCookie = () => {
    return new Promise((resolve) => {
        // console.log('Not actually getting session id');
        resolve('boop')
    })
    return new Promise((resolve, reject) => {
        fs.readFile('tmp/hhs_authentication_cookies.txt', 'utf8', (err, content) => {
            if (err) {
                console.log('Error reading cookie file', err);
                reject();
            }

            const sessionIdRegExp = RegExp('sessionid\s*(.*)\s*')
            const sessionId = sessionIdRegExp.exec(content)[1];
            resolve(`sessionid=${sessionId.trim()}`);
        })
    })
}

const addHyphensToId = (id) => {
    const str = id.toString();
    return `${str.substring(0,8)}-${str.substring(8,12)}-${str.substring(12)}`
}

const buildUrl = (name, id) => {
    const nameForUrl = normalizeName(name).toLowerCase().replace("'", '').split(' ').join('-');
    return `${process.env.HHS_PLAYER_BASE_URI}${nameForUrl}-stats-${addHyphensToId(id)}-${getSuffixForPlayer(name)}`;
}

const scrapeStatsFor = (name, id, stats) => {
    if (!id) {
        console.log('No id for', name)
        return Promise.resolve({});
    }
    
    return getSessionIdCookie().then((cookie) => {
        // console.log('cookie', cookie)
        return new Promise((resolve) => {
            request({
                method: 'GET',
                uri: buildUrl(name, id),
                forever: true,
                headers: {
                    'Connection': 'keep-alive',
                    'Cache-Control': 'max-age=0',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36',
                    'Sec-Fetch-User': '?1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'navigate',
                    'Referer': 'https://herhoopstats.com/',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'dnt': '1',
                    // 'Referer': process.env.HHS_BASE_URI
                    'cookie': `csrftoken=${process.env.HHS_CSRF_TOKEN}; sessionid=${process.env.HHS_SESSION_ID}`
                },
            }, (error, response, body) => {
                if (error) {
                    console.log(`Problem getting stats for ${name} at ${process.env.HHS_PLAYER_BASE_URI}${id}-${suffix}`)
                    console.log(error)
                }

                // console.log('REQQ', response.request.req.toCurl())
    
                console.log(`Scraping stats for ${name}`);
                if (!body) {
                    console.log(`No body for ${name}`);
                    resolve({})
                }
                let newBody = body.split(/<body>|<\/body>/);
                let html = newBody[1] + newBody[2];
                // html = html.replace(/<script.*<\/script>/, '');
                const dom = new JSDOM(html);
                const statObj = stats.reduce((memo, stat) => {
                    let statInfo = STAT_INFO[stat].HHS;
                    // let nextNode = jQuery(dom.window)(`.tab-pane.2018-19 td:contains("${statInfo.LABEL}")${statInfo.NOT_INCLUDE ? `:not(:contains("${statInfo.NOT_INCLUDE}"))` : ''}:not(".visible-xs")`).first().next();
                    let nextNode = jQuery(dom.window)(`td:contains("${statInfo.LABEL}")${statInfo.NOT_INCLUDE ? `:not(:contains("${statInfo.NOT_INCLUDE}"))` : ''}:not(".visible-xs")`).first().next();
                    let statText = nextNode.hasClass('visible-xs') ? nextNode.next().text() : nextNode.text();
                    memo[stat] = statText;
                    return memo;
                }, {});
                resolve(statObj);
            });
        })
    })
}

const getStatsFromCache = (name, stats) => {
    return getCachedPlayerStats(name, getCachedPlayerStatsPath(name, `${__dirname}/cachedPlayerStats`)).then((cachedPlayerStats) => {
        if (!cachedPlayerStats) {
            return null;
        }

        const statsObj = {};
        let statMissingFromCache = false;
        // console.log(cachedPlayerStats)
        stats.forEach((stat) => {
            if (!cachedPlayerStats[stat] && stat !== 'THREE_PERCENTAGE') {
                // console.log(`${stat} missing from cache for ${name}`);
                statMissingFromCache = true;
            }

            statsObj[stat] = cachedPlayerStats[stat];
        });
          
        // if (statMissingFromCache) {
        //     console.log('Stats missing from cache for', name)
        // } else {
            console.log(`Got player stats for ${name} from cache`);
        // }
        return statMissingFromCache ? null : statsObj;
    });
}

const getStatsFor = (name, id, stats) => {
    return getStatsFromCache(name, stats).then((cachedStats) => {
        if (cachedStats) {
            return cachedStats;
        } else {
            return scrapeStatsFor(name, id, stats).then((scrapedStats) => {
                cachePlayerStats(name, scrapedStats, getCachedPlayerStatsPath(name, `${__dirname}/cachedPlayerStats`));
                return scrapedStats;
            });
        }
    });
}

const addStatsToPlayer = (player, id, statList) => {
    return getStatsFor(player.name, id, statList).then((playerStats) => {
        return { ...player, ...playerStats };
    });
}

const scrape = (players, { statList }) => {
    return getPlayerIdFinder(players).then((playerIdFinder) => {
        // return login().then((jar) => {
        //     console.log('jar', jar)

            // const playersWithStats = [];
            // const playersPool = new PromisePool(players.map((player) => {
            //     return addStatsToPlayer({ name: player }, playerIdFinder(player), statList)
            //         .then((playerWithStats) => playersWithStats.push(playerWithStats));
            // }), 10);

            
            // return new Promise((resolve) => {
            //     playersPool.start().then(() => {
            //         resolve(playersWithStats);
            //     });
            // });
            const batchedPlayers = putInBatches(players, 2);

            return batchedPlayers.reduce((promiseChain, batch) => {
                return promiseChain.then((playersWithStatsSoFar) => {
                    return Promise.all(batch.map((player) => {
                        return addStatsToPlayer({ name: player }, playerIdFinder(player), statList);
                    })).then((playersWithStats) => {
                        return playersWithStatsSoFar.concat(playersWithStats);
                    }).then((playersSoFar) => {
                        return new Promise((resolve, reject) => {
                            setTimeout(() => {
                                resolve(playersSoFar)
                            }, 3500)
                        })
                    })
                })
            }, Promise.resolve([]));

            // return Promise.all(players.map((player) => {
            //     return addStatsToPlayer({ name: player }, playerIdFinder(player), statList);
            // }));
        // })
    });
}

module.exports = { scrape };