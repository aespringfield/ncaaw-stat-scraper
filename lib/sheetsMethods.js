const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const backoff = require('backoff');
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = './token.json';
require('dotenv').config();
const SHEET_ID = process.env.SENIORS_SHEET_ID;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
const authorize = (credentials, callback) => {
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
const getNewToken = (oAuth2Client, callback) => {
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

const getSheets = (auth, version='v4') => {
    return google.sheets({version, auth});
}

const requestWithBackoff = (requestMethod, args, callback) => {
  const call = backoff.call(requestMethod, args, (err, res) => {
    console.log('Num retries: ' + call.getNumRetries());
    if (err) {
        console.log('Error: ' + err.message);
    } else {
        callback(res);
    }
  });

  call.retryIf(function(err) { return !!err; });
  call.setStrategy(new backoff.ExponentialStrategy());
  call.failAfter(10);
  call.start();
}

const listPlayers = (sheets) => {
    return new Promise((resolve) => {
        requestWithBackoff(
          sheets.spreadsheets.values.get,
          {
            spreadsheetId: SHEET_ID,
            range: 'Sheet1!A2:A33',
          },
          (res) => {
            if (!res) {
              return;
            }

            const rows = res.data.values;
            if (rows.length) {
              console.log(`Got ${rows.length} players from sheet`);
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
          }
        )
    });
  }

const setPlayerData = (sheets, sheetId, range, resource) => {
  requestWithBackoff(
    sheets.spreadsheets.values.update,
    {
      spreadsheetId: sheetId,
      valueInputOption: 'USER_ENTERED',
      range,
      resource
    },
    (res) => {
      console.log('response data', res.data);
    }
  );
}

module.exports = { getSheets, listPlayers, setPlayerData, authorize };