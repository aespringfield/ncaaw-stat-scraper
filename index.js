const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
require('dotenv').config();

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
// const { grabbedData } = require('./grabbedData');


function writePlayers(players) {
    fs.readFile('credentials.json', (err, content) => {
        authorize(JSON.parse(content), (response) => {
            setPlayerData(response, players);
        });
    });
}

readPlayers().then((players) => {
    console.log('players:', players),
    console.log('*******')
    addStatToPlayers(players, 'POINTS_PER_GAME', 'PPG')
        .then((players) => {
            console.log('ASSISTS_PER_GAME')
            return addStatToPlayers(players, 'ASSISTS_PER_GAME', 'APG')
        })
        .then((players) => {
            console.log('FIELD_GOAL_PERCENTAGE')
            return addStatToPlayers(players, 'FIELD_GOAL_PERCENTAGE', 'FG%')
        })
        .then((players) => {
            console.log('REBOUNDS_PER_GAME')
            return addStatToPlayers(players, 'REBOUNDS_PER_GAME', 'RPG')
        })
        .then((players) => {
            console.log('THREES_MADE')
            return addStatToPlayers(players, 'THREES_MADE', '3FG', 3)
        })
        .then((players) => {
            console.log('THREE_PERCENTAGE',)
            return addStatToPlayers(players, 'THREE_PERCENTAGE', '3FG%')
        })
        .then((players) => {
            console.log('STEALS_PER_GAME')
            return addStatToPlayers(players, 'STEALS_PER_GAME', 'SPG')
        })
        .then((players) => {
            console.log('players:', players)
            console.log('writing players')
            writePlayers(players);
        })
    });

// writePlayers(grabbedData);


// // Load client secrets from a local file.
// fs.readFile('credentials.json', (err, content) => {
//   if (err) return console.log('Error loading client secret file:', err);
//   // Authorize a client with credentials, then call the Google Sheets API.
//   authorize(JSON.parse(content), (response) => {
//     listPlayers(response).then(
//     });
//   });

// uncomment to post to sheet
//   authorize(JSON.parse(content), setPlayerData);
//   getStatFor('ASSISTS_PER_GAME');
// });

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
                name: row[0].trim(),
                school: row[1].trim()
            });
          });
          resolve(players);
        } else {
          console.log('No data found.');
        }
      });
  });
}

function addStatToPlayers(players, statName, statAbbrev, maxPages) {
    return new Promise((resolve, reject) => {
        getStatFor(statName, maxPages).then((response, error) => {
            const newPlayers = players.map((player) => {
                const stat = response.reduce((memo, responsePlayer) => {
                    if (responsePlayer.Name.trim() === player.name) {
                        memo = responsePlayer[statAbbrev];
                    }
                    return memo;
                }, null);

                if (stat) {
                    player[statName] = stat;
                }

                return player;
            });
            resolve(newPlayers);
        })
        .catch((error) => {
            console.log('error', error);
            resolve(addStatToPlayers(players, statName, statAbbrev, maxPages))
            // reject(error);
        });
    });
}

function setPlayerData(auth, players) {
    const sheets = google.sheets({version: 'v4', auth});
    const sheetId = process.env.SENIORS_SHEET_ID
    sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Sheet1!D1:J33',
        valueInputOption: 'USER_ENTERED',
        resource: {
            "majorDimension": "COLUMNS",
            "values": [
              ['Points per game'].concat(players.map((player) => {
                return player.POINTS_PER_GAME;
              })),
              ['Field goal %'].concat(players.map((player) => {
                return player.FIELD_GOAL_PERCENTAGE;
              })),
              ['Threes made'].concat(players.map((player) => {
                return player.THREES_MADE;
              })),
              ['Three %'].concat(players.map((player) => {
                return player.THREE_PERCENTAGE;
              })),
              ['Rebounds per game'].concat(players.map((player) => {
                return player.REBOUNDS_PER_GAME;
              })),
              ['Assists per game'].concat(players.map((player) => {
                return player.ASSISTS_PER_GAME;
              })),
            //   ['Steals per game'].concat(players.map((player) => {
            //     return player.STEALS_PER_GAME;
            //   })),
            ],
          }
    }, (err, res) => {
        if (err) return console.log('The API returned an error on update: ' + err);
        const responseData = res;
        console.log('response data', res.data);
    });
}


const request = require('request');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const ROUTE_NUMBERS = require('./routeNumbers');
const BASE_ROUTE = 'https://www.ncaa.com/stats/basketball-women/d1/current/individual';

function getStatFor(stat, maxPages=5, players=[], page=null) {
    return new Promise((resolve, reject) => {
        console.log('running for page', page + 1)
        request(`${BASE_ROUTE}/${ROUTE_NUMBERS[stat]}/${ page ? `p${page}` : '' }`, (error, response, body) => {
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
    }).then(({ newPlayers, maxPages, stat, page }) => {
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