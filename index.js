const fs = require('fs');
const _ = require('lodash');
const readline = require('readline');
const { google } = require('googleapis');
require('dotenv').config();

const request = require('request');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const STAT_INFO = require('./routeNumbers');
const STATS_TO_FETCH = require('./statsToFetch');
const { grabbedData } = require('./grabbedData');
const BASE_ROUTE = 'https://www.ncaa.com/stats/basketball-women/d1/current/individual';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
const SHEET_ID = process.env.SENIORS_SHEET_ID;

function readPlayers() {
    return new Promise((resolve, reject) => {
        fs.readFile('credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(JSON.parse(content), (response) => {
                resolve(listPlayers(response));
            })
        })
    });
}


function writePlayers(players, stats) {
    const { range, resource } = buildSheetValues(players, stats);
    fs.readFile('credentials.json', (err, content) => {
        authorize(JSON.parse(content), (response) => {
            setPlayerData(response, range, resource);
        });
    });
}

function addStatsToPlayers(players, stats) {
    return new Promise((resolve, reject) => {
        const { NAME: parentStat, MAX_PAGES, SUBSTATS } = stats[0];
        resolve(addStatToPlayers(players, parentStat, MAX_PAGES, SUBSTATS));
    }).then((players) => {
        const statsLeft = stats.slice(1);
        return statsLeft.length > 0 ? addStatsToPlayers(players, statsLeft) : players;
    });
}

readPlayers().then((players) => {
    addStatsToPlayers(players, STATS_TO_FETCH)
    .then((players) => {
        console.log('players:', players)
        console.log('writing players')    
        writePlayers(players, STAT_INFO); 
    })
})

// writePlayers(grabbedData, STAT_INFO);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listPlayers(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  return new Promise((resolve, reject) => {
    sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Sheet1!A2:C33',
      }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
          // Get senior info
          const players = [];
          rows.map((row) => {
            players.push({
                name: row[0].trim()
            });
          });
          resolve(players);
        } else {
          console.log('No data found.');
        }
      });
  });
}

function addStatToPlayers(players, parentStat, maxPages, substats) {
    return new Promise((resolve, reject) => {
        console.log('Stat:', parentStat);
        getStatFor(parentStat, maxPages).then((response, error) => {
            const newPlayers = players.map((player) => {
                return response.reduce((newPlayer, responsePlayer) => {
                    if (responsePlayer.Name.trim() === player.name) {
                        const stats = substats ? substats : [parentStat];
                        stats.forEach((stat) => {
                            newPlayer[stat] = responsePlayer[STAT_INFO[stat].STAT_ABBREV];
                        });
                    }
                    return newPlayer;
                }, {...player});
            });
            resolve(newPlayers);
        })
        .catch((error) => {
            console.log('error', error);
            resolve(addStatToPlayers(players, statName, maxPages))
            // reject(error);
        });
    });
}

function buildSheetValues(players, statsInfo) {
    const sortedStats = Object.entries(statsInfo)
    .filter(([statName, statInfo]) => {
        return statInfo.ANNA_COLUMN;
    })
    .sort(([statNameA, statInfoA], [statNameB, statInfoB]) => {
        return statInfoA.ANNA_COLUMN < statInfoB.ANNA_COLUMN ? -1 : 1;
    });

    const values = sortedStats.map(([statName, statInfo]) => {
        return [statInfo.ANNA_COLUMN_NAME].concat(
            players.map((player) => {
                return player[statName] || null;
            })
        );
    });
    return {
        range: `Sheet1!${sortedStats[0][1].ANNA_COLUMN}1:${_.last(sortedStats)[1].ANNA_COLUMN}${players.length + 1}`,
        resource: {
            "majorDimension": "COLUMNS",
            "values": values
        }
    };
}

function setPlayerData(auth, range, resource) {
    const sheets = google.sheets({version: 'v4', auth});
    const sheetId = process.env.SENIORS_SHEET_ID
    sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        valueInputOption: 'USER_ENTERED',
        range,
        resource
    }, (err, res) => {
        if (err) return console.log('The API returned an error on update: ' + err);
        console.log('response data', res.data);
    });
}

function getStatFor(stat, maxPages=5, players=[], page=null) {
    return new Promise((resolve, reject) => {
        console.log('running for page', page + 1)
        request({
            method: 'GET',
            uri: `${BASE_ROUTE}/${STAT_INFO[stat].ROUTE_NUMBER}/${ page ? `p${page}` : '' }`,
            forever: true
        }, (error, response, body) => {
            if (error) {
                console.log('error:', error);
                resolve(players);
            }
            let newBody = body.split(/<head>|<\/head>/);
            let html = newBody[0] + newBody[2];
            const dom = new JSDOM(html);
            const newPlayers = players.concat(buildPlayers(getRows(dom.window.document)));
            console.log('length', newPlayers.length);
            resolve({newPlayers, maxPages, stat, page: page ? page + 1 : 1});
        });
    })
    .then(({ newPlayers, maxPages, stat, page }) => {
        return (page > maxPages ? players : getStatFor(stat, maxPages, newPlayers, page))
    });
}

function getRows(page) {
    const headRow = page.querySelector('.block-stats__stats-table thead tr');
    const bodyRows = page.querySelectorAll('.block-stats__stats-table tbody tr');
    return { headRow, bodyRows };
}

function buildPlayers({ headRow, bodyRows }) {
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