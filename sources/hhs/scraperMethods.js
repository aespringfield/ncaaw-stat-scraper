const request = require('request');
const { getPlayerId } = require('./playerIdMethods')
const STAT_INFO = require('./statInfo');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const xpath = require('xpath');
require('dotenv').config();

const getStatsFor = (name, stats) => {
    return getPlayerId(name).then((id) => {
        if (!id) {
            return;
        }

        console.log(`Getting stats for ${name}`)
        // console.log(`${process.env.HHS_PLAYER_BASE_URI}${id}-${process.env.HHS_URI_SUFFIX}`)
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
                // console.log(html.match(/Shooting/)[0])
                const dom = new JSDOM(html);
                const jQuery = require('jquery')(dom.window);
                const statObj = stats.reduce((memo, stat) => {
                    let nextNode = jQuery(`td:contains("${STAT_INFO[stat].LABEL}")${STAT_INFO[stat].NOT_INCLUDE ? `:not(:contains("${STAT_INFO[stat].NOT_INCLUDE}"))` : ''}:not(".visible-xs")`).first().next();
                    let statText = nextNode.hasClass('visible-xs') ? nextNode.next().text() : nextNode.text();
                    memo[stat] = statText;
                    return memo;
                }, {});
                resolve(statObj);
                // console.log(jQuery('td:contains("Field Goal %"):not(".hidden-xs")').first().next('td').text)

                // console.log('statObj', statObj);


                // // console.log(tableBits)
                // const tableBits = Array.from(dom.window.document.getElementsByTagName('table'));
                // tableBits.forEach((tableBit) => {
                //     let trs = Array.from(tableBit.getElementsByTagName('tr'));
                //     // console.log(trs[0])

                //     trs.slice(1).forEach((tr) => {
                //         let tds = Array.from(tr.getElementsByTagName('td'))
                //         tds.forEach((td) => {
                //             // console.log(td.textContent)
                //         })
                //     })
                //     // if (firstTr) {
                //     //     let tds = Array.from(firstTr.getElementsByTagName('td'))
                //     //     tds.forEach((td) => {
                //     //         console.log(td.textContent)
                //     //     })
                //     // }
                // })

                // const myXpath = "//th";
                // const doc = dom.window.document;
                // const matchingElement = xpath.evaluate(myXpath, doc, null, xpath.XPathResult.ANY_TYPE, null);
                // const tds = document.getElementsByTagName('td');
                // console.log(tds);
                // console.log('matchingElement', matchingElement)
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
    return Promise.all(players.map((player) => {
        return addStatsToPlayer(player, statList);
    }));
}

module.exports = { scrape };

// getStatsFor('Arike Ogunbowale', Object.keys(STAT_INFO)).then((obj) => console.log(obj));
