const puppeteer = require('puppeteer')
const STAT_INFO = require('../../statInfo')
const { cachePlayerStats, getCachedPlayerStats, getCachedPlayerStatsPath } = require('../../utils/cachingMethods');
const config = require("../../config.json");

const url = 'https://www.herhoopstats.com'

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

  if (playerName === 'Haley Jones' || playerName === 'Emily Kiser' || playerName == 'Aaliyah Moore' || playerName == 'Brittany Davis' || playerName == 'Paige Robinson') { // Differentiate from the other Haley Jones, who shows up first
    const playerPageLinks = await page.$$(".form-group-player-team-search > [role='listbox'] > .dropdown-item")
    await playerPageLinks[1].click()
  } else if (playerName === 'Jenna Clark' || playerName === 'Gabby Gregory') {
    const playerPageLinks = await page.$$(".form-group-player-team-search > [role='listbox'] > .dropdown-item")
    await playerPageLinks[2].click()
  } else if (playerName === 'Raven Johnson') {
    const playerPageLinks = await page.$$(".form-group-player-team-search > [role='listbox'] > .dropdown-item")
    await playerPageLinks[3].click()
  }
  else {
    await page.click(playerPageLinkSelector)
  }

  await page.waitForSelector(`text/${playerName} Statistics`)
}

const getStatsFromCache = (name, stats, year) => {
  const cacheValidHours = new Date().getFullYear().toString() === year ? 2 : 10000000

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

const getStatsForPlayer = async (page, playerName, stats, year) => {
  if(
    playerName === 'Imani McGee Stafford' ||
    playerName === 'Courtney Walker' ||
    playerName === 'Niya Johnson' ||
    playerName === 'Jordan Jones' ||
    playerName === 'Alexis Jones' ||
    playerName === 'Marie Gülich' ||
    playerName === 'Diamond DeShields' ||
    playerName === 'Jazmine Jones'
  ) {
    return {}
  }

  const cachedStats = await getStatsFromCache(playerName, stats, year)
  if (cachedStats) { return cachedStats }

  const scrapedStats = await scrapeStatsForPlayer(page, playerName, stats, year)
  await cachePlayerStats(playerName, scrapedStats, getCachedPlayerStatsPath(playerName, `${__dirname}/cachedPlayerStats-${year}`));
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
  await page.goto(url)
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

const scrape = async (playerNames, { statList, year }) => {
  return await runInBrowser(url, async (page) => {
    const playerStats = await playerNames.reduce(async (memo, playerName) => {
      const list = await memo
      try {
        list.push(await getStatsForPlayer(page, playerName, statList, year))
      } catch (err) {
        throw `Stats fetching for ${playerName} failed with the following message: ${err}`
      }

      return list
    }, [])
    return playerStats
  }, { headless: false })
}

module.exports = { scrape }
