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
// const SENIORS_SHEET_NAME = '2020 class last year';
// const SENIORS_SHEET_NAME = '2020 class two years ago';
const SENIORS_SHEET_NAME = '2020 draft class';
const ROOKIES_SHEET_NAME = '2019 draft class';
const CLASS_2021_SHEET_NAME = '2021 draft class';
const CLASS_2018_SHEET_NAME = '2018 draft class';
const CLASS_2016_SHEET_NAME = '2016 draft class';
const CLASS_2017_SHEET_NAME = '2017 draft class';
const CLASS_2015_SHEET_NAME = '2015 draft class';
const PLAYERS_SHEET = 'All players';
const SOPHOMORE_PLAYERS_SHEET = 'All players - sophomore';
const TWO_YEAR_VET_PLAYERS_SHEET = 'All players - 2 year vet';
const THREE_YEAR_VET_PLAYERS_SHEET = 'All players - 3 year vet';
const RANGES = {
  PLAYER_NAMES: 'A2:A165',
  HEADINGS: 'A1:BY1',
  ALL_VALUES: 'A1:BY165'
}

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
  ``
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
  // TODO: Change so uses league to determine which sheet to use?

  if (config.DRAFT_YEAR === 'ALL' && config.STATS_YEAR === 'SOPHOMORE') {
    return SOPHOMORE_PLAYERS_SHEET;
  }

  if (config.DRAFT_YEAR === 'ALL' && config.STATS_YEAR === 'TWO YEAR VET') {
    return TWO_YEAR_VET_PLAYERS_SHEET;
  }

  if (config.DRAFT_YEAR === 'ALL' && config.STATS_YEAR === 'THREE YEAR VET') {
    return THREE_YEAR_VET_PLAYERS_SHEET;
  }

  switch(config.DRAFT_YEAR) {
    case '2015':
      return CLASS_2015_SHEET_NAME;
    case '2016':
      return CLASS_2016_SHEET_NAME;
    case '2017':
      return CLASS_2017_SHEET_NAME;
    case '2018':
      return CLASS_2018_SHEET_NAME;
    case '2019':
      return ROOKIES_SHEET_NAME;
    case '2020':
      return SENIORS_SHEET_NAME;
    case '2021':
      return CLASS_2021_SHEET_NAME;  
    case 'NA':
      return PLAYERS_SHEET;
    case 'ALL':
      return PLAYERS_SHEET;
    default:
      return SENIORS_SHEET_NAME;
  }
}

// requestedRanges is array of strings, i.e. ['A1:A126']
const getRanges = (sheets, requestedRanges) => {

  const ranges = requestedRanges.map((range) => {
    return `${getSheetName()}!${range}`;
  });

  return new Promise((resolve, reject) => {
    requestWithBackoff(
      sheets.spreadsheets.values.batchGet,
      {
        spreadsheetId: SHEET_ID,
        ranges
      },
      (res) => {
        if (!res) {
          console.log(`No response to batchGet for ${requestedRanges}`);
          reject();  
        }

        if (!res.data.valueRanges) {
          console.log(`ValueRanges not found for ${requestedRanges}`);
          reject();
        }

        resolve(res.data.valueRanges);
      }
    );
  });
}

const listHeadingsAndPlayersByYear = (sheets, opts = { yearOffset: 0 }) => {
  return getRanges(sheets, [RANGES.ALL_VALUES]).then((valueRanges) => {
    const [allValues] = valueRanges;
    const [headings, ...playerRows] = allValues.values;
    const nameColumnIndex = headings.findIndex((heading) => {
      return heading === 'Name';
    })

    const yearColumnIndex = headings.findIndex((heading) => {
      console.log('heading', heading)
      return heading === 'Year';
    })

    console.log('yearColumnIndex', yearColumnIndex)

    const playersByYear = playerRows.reduce((groupedPlayers, playerRow) => {
      const playerName = playerRow[nameColumnIndex];
      const year = (parseInt(playerRow[yearColumnIndex]) + opts.yearOffset).toString();

      if (groupedPlayers[year]) {
        groupedPlayers[year].push(playerName);
      } else {
        groupedPlayers[year] = [playerName];
      }

      return groupedPlayers;
    }, {});

    return ({ headings, playersByYear });
  })
}

const listHeadingsAndPlayers = (sheets, requestedRanges) => {
  console.log('in list headings and players')

  return getRanges(sheets, [RANGES.HEADINGS, RANGES.PLAYER_NAMES]).then((valueRanges) => {
    const [headingsData, unflattenedPlayersData] = valueRanges;
    const headings = headingsData.values[0];
    const players = unflattenedPlayersData.values.reduce((players, player) => {
      players.push(player[0])
      return players;
    }, []);
      
    return ({ headings, players })
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

module.exports = { getSheets, getSheetName, listHeadingsAndPlayers, setPlayerData, listHeadingsAndPlayersByYear, authorize };