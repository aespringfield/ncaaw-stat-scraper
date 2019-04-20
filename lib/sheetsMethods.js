const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const backoff = require('backoff');
const config = require('./config');
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = './token.json';
require('dotenv').config();
const SHEET_ID = process.env.SENIORS_SHEET_ID;
const SENIORS_SHEET_NAME = "'This year''s prospects'";
const ROOKIES_SHEET_NAME = "'Last year''s draft class'";
const CLASS_2016_SHEET_NAME = '2016 draft class';
const CLASS_2017_SHEET_NAME = '2017 draft class';
const CLASS_2015_SHEET_NAME = '2015 draft class';

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

const getSheetName = () => {
  switch(config.YEAR) {
    case '2015':
      return CLASS_2015_SHEET_NAME;
    case '2016':
      return CLASS_2016_SHEET_NAME;
    case '2017':
      return CLASS_2017_SHEET_NAME;
    case '2018':
      return ROOKIES_SHEET_NAME;
    default:
      return SENIORS_SHEET_NAME;
  }
}

const listHeadingsAndPlayers = (sheets) => {
  return new Promise((resolve) => {
    requestWithBackoff(
      sheets.spreadsheets.values.batchGet,
      {
        spreadsheetId: SHEET_ID,
        ranges: [`${getSheetName()}!A1:AZ1`, `${getSheetName()}!A2:A55`]
      },
      (res) => {
        if (!res) {
          return;
        }

        if (res.data.valueRanges) {
          const [headingsData, unflattenedPlayersData] = res.data.valueRanges;
          const headings = headingsData.values[0];
          const players = unflattenedPlayersData.values.reduce((players, player) => {
            players.push(player[0])
            return players;
          }, []);
          
          resolve({ headings, players })
        } else {
          console.log('No data found');
        }
      }
    )
  });
}

const setPlayerData = (sheets, sheetId, updateMethodName, params) => {
  requestWithBackoff(
    sheets.spreadsheets.values[updateMethodName],
    {
      spreadsheetId: sheetId,
      ...params
    },
    (res) => {
      console.log('response data', res.data);
    }
  );
}

module.exports = { getSheets, getSheetName, listHeadingsAndPlayers, setPlayerData, authorize };