const puppeteer = require('puppeteer')
const STAT_INFO = require('../../statInfo')
const { cachePlayerStats, getCachedPlayerStats, getCachedPlayerStatsPath } = require('../../utils/caching.cjs');

const DEFAULT_OPTS = {
  url: 'https://www.herhoopstats.com',
  useCaching: true
}

const fillLabeledInput = async (page, label, fill) => {
  const labelSelector = `text/${label}`
  await page.waitForSelector(labelSelector)
  await page.click(labelSelector)
  await page.keyboard.type(fill)
}

const navigateToPlayerPage = async (page, playerName) => {
  const searchBarSelector = 'aria/Search'
  const searchBarNode = await page.waitForSelector(searchBarSelector);
  await searchBarNode.click({ clickCount: 3 }) // Select any previously entered text so that next entered text will replace it
  await page.keyboard.type(playerName)

  const playerPageLinkSelector = `text/${playerName} | NCAA`
  await page.waitForSelector(playerPageLinkSelector)

  if (['Haley Jones', 'Emily Kiser', 'Aaliyah Moore', 'Brittany Davis', 'Paige Robinson', 'Chelsea Gray', 'Tayler Hill', "Jasmine James", "Kennedy Brown", "Reigan Richardson"].includes(playerName)) { // Differentiate from the other Haley Jones, who shows up first
    const playerPageLinks = await page.$$(".form-group-player-team-search > [role='listbox'] > .dropdown-item")
    await playerPageLinks[1].click()
  } else if (['Jenna Clark', 'Gabby Gregory', 'Taylor Jones'].includes(playerName)) {
    const playerPageLinks = await page.$$(".form-group-player-team-search > [role='listbox'] > .dropdown-item")
    await playerPageLinks[2].click()
  } else if (['Raven Johnson', 'Jenna Johnson'].includes(playerName)) {
    const playerPageLinks = await page.$$(".form-group-player-team-search > [role='listbox'] > .dropdown-item")
    await playerPageLinks[3].click()
  }
  else {
    await page.click(playerPageLinkSelector)
  }

  await page.waitForSelector(`text/${playerName} Statistics`)
}

const isInSeason = (year) => {
  const currentDate = new Date();
  const yearAsNumber = parseInt(year, 10);

  // Create a date for the beginning of November of the previous year
  const startOfRange = new Date(yearAsNumber - 1, 10, 1); // November 1st of the previous year

  // Create a date for the end of April of the year
  const endOfRange = new Date(yearAsNumber, 3, 30); // April 30th of the year

  // Check if the current date falls within the range
  return currentDate >= startOfRange && currentDate <= endOfRange;
}

const getStatsFromCache = (name, stats, year) => {
  const cacheValidHours = isInSeason(year) ? 2 : 10000000

  return getCachedPlayerStats(name, getCachedPlayerStatsPath(name, `${__dirname}/cachedPlayerStats-${year}`), cacheValidHours).then((cachedPlayerStats) => {
    if (!cachedPlayerStats) {
      return null
    }

    const statsObj = {}
    let statMissingFromCache = false
    stats.forEach((stat) => {
      if (!cachedPlayerStats[stat]) {
        statMissingFromCache = true
      }

      statsObj[stat] = cachedPlayerStats[stat];
    });

    if (!statMissingFromCache) {
      console.log(`Got player stats for ${name} from cache`);
    }
    return statMissingFromCache ? null : statsObj;
  });
}

const getStatsForPlayer = async (page, playerName, stats, year, opts) => {
  const { useCaching } = { ...DEFAULT_OPTS, ...opts }

  let cachedStats;
  if (useCaching && (cachedStats = await getStatsFromCache(playerName, stats, year))) {
    return cachedStats;
  }

  if(
    playerName === 'Imani McGee Stafford' ||
    playerName === 'Courtney Walker' ||
    playerName === 'Niya Johnson' ||
    playerName === 'Jordan Jones' ||
    playerName === 'Alexis Jones' ||
    playerName === 'Marie Gülich' ||
    playerName === 'Diamond DeShields' ||
    playerName === 'Jazmine Jones' ||
    playerName === 'Olivia Miles' || // Remove this when she gets well
    playerName === 'Teonni Key' ||
    playerName === 'Montaya Dew'
  ) {
    return {}
  }

  const scrapedStats = await scrapeStatsForPlayer(page, playerName, stats, year)

  if (useCaching) {
    await cachePlayerStats(playerName, scrapedStats, getCachedPlayerStatsPath(playerName, `${__dirname}/cachedPlayerStats-${year}`));
  }

  return scrapedStats
}

const convertHTMLTableToHash = async (parentNode, year) => {
  const headings = await parentNode.$eval('table', (tableNode) => {
    return Array.from(tableNode.querySelectorAll('th')).map(th => th.innerText.trim())
  })

  const textRows = await parentNode.$eval('tbody', (tbodyNode) => {
    return Array.from(tbodyNode.rows).map((tr) => {
      return Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())
    })
  })

  const yearRegExp = new RegExp(`\\d\\d\\d\\d-${year.slice(2)}`)
  const yearIndex = textRows
    .map((row) => row[0]) // Season is stored in first cell formatted like this: '2022-23'
    .findIndex((yearString) => yearString.match(yearRegExp))

  if (yearIndex === -1) {
    throw `Year data for ${year} not found for this player`
  }

  const yearRowValues = textRows[yearIndex]

  return headings.reduce((memo, th, i) => {
    memo[th.toLowerCase()] = yearRowValues[i]
    return memo
  }, {})
}

const addStatsToMemoFrom = (statsHash) => {
  return (memo, stat) => {
    const statLabel = STAT_INFO[stat].HHS.LABEL.toLowerCase()
    memo[stat] = statsHash[statLabel] || memo[stat]
    return memo;
  }
}

const scrapeBasicStats = async (page, stats, year, memo={}) => {
  const label = 'Per Game'
  const statsHash = await getStatsHashFromTableWithLabel(page, label, year)
  return stats.reduce(addStatsToMemoFrom(statsHash), { ...memo })
}

const scrapeAdvancedStats = async (page, stats, year, memo={}) => {
  const label = 'Advanced'
  const statsHash = await getStatsHashFromTableWithLabel(page, label, year)
  return stats.reduce(addStatsToMemoFrom(statsHash), { ...memo });
}

const getStatsHashFromTableWithLabel = async (page, label, year) => {
  const headingNode = await page.waitForSelector(`text/${label}`)
  const divNode = await headingNode.getProperty('parentNode')
  const hash = await convertHTMLTableToHash(divNode, year)
  return hash
}

const scrapeStatsForPlayer = async (page, playerName, stats, year) => {
  await navigateToPlayerPage(page, playerName)
  const statsObj = await scrapeBasicStats(page, stats, year)
  return await scrapeAdvancedStats(page, stats.filter(stat => stat != "MINUTES_PER_GAME"), year, statsObj) // This minutes stat has the same label but is total minutes played
}

const runInBrowser = async (url, callback, opts={}) => {
  const browser = await puppeteer.launch(opts)
  const page = await browser.newPage()
  await page.goto(url, {
    // networkidle2 is fired when there are no more than 2 network connections for 500 ms,
    // as compared with networkidle0, which is fired when there are 0 network connections for 500ms.
    // In this case, networkidle2 works better as a check bc there may be a video streaming
    // as well as ads loading or trackers pinging
    waitUntil: "networkidle2",
    timeout: 60000
  });
  await page.setViewport({ width: 1366, height: 768})
  const results = await callback(page)
  await browser.close()
  return results
}

const signIn = async (page, email, password) => {
  const signInSelector = 'text/Sign in'
  await page.waitForSelector(signInSelector)
  await page.click(signInSelector)

  await fillLabeledInput(page, 'Email', email)
  await fillLabeledInput(page, 'Password', password)

  const logInButtonSelector = 'text/Log in'
  await page.click(logInButtonSelector)
}

const scrape = async (playerNames, { statList, year }, opts = {}) => {
  const { url, useCaching } = { ...DEFAULT_OPTS, ...opts }

  return await runInBrowser(url, async (page) => {
    const playerStats = await playerNames.reduce(async (memo, playerName) => {
      const list = await memo
      try {
        list.push(await getStatsForPlayer(page, playerName, statList, year, { useCaching }))
      } catch (err) {
        throw `Stats fetching for ${playerName} failed with the following message: ${err}`
      }

      return list
    }, [])
    return playerStats
  }, { headless: false })
}

module.exports = { scrape }
