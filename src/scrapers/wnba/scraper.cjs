const puppeteer = require('puppeteer')
const STAT_INFO = require('../../statInfo')
const { cachePlayerStats, getStatsFromCache, getCachedPlayerStatsPath } = require('../../utils/caching.cjs');

const DEFAULT_OPTS = {
  url: 'https://stats.wnba.com',
  useCaching: true
}

async function installMouseHelper(page) {
  await page.evaluateOnNewDocument(() => {
    // Install mouse helper only for top-level frame.
    if (window !== window.parent)
      return;
    window.addEventListener('DOMContentLoaded', () => {
      const box = document.createElement('puppeteer-mouse-pointer');
      const styleElement = document.createElement('style');
      styleElement.innerHTML = `
        puppeteer-mouse-pointer {
          pointer-events: none;
          position: absolute;
          top: 0;
          z-index: 10000;
          left: 0;
          width: 20px;
          height: 20px;
          background: rgba(0,0,0,.4);
          border: 1px solid white;
          border-radius: 10px;
          margin: -10px 0 0 -10px;
          padding: 0;
          transition: background .2s, border-radius .2s, border-color .2s;
        }
        puppeteer-mouse-pointer.button-1 {
          transition: none;
          background: rgba(0,0,0,0.9);
        }
        puppeteer-mouse-pointer.button-2 {
          transition: none;
          border-color: rgba(0,0,255,0.9);
        }
        puppeteer-mouse-pointer.button-3 {
          transition: none;
          border-radius: 4px;
        }
        puppeteer-mouse-pointer.button-4 {
          transition: none;
          border-color: rgba(255,0,0,0.9);
        }
        puppeteer-mouse-pointer.button-5 {
          transition: none;
          border-color: rgba(0,255,0,0.9);
        }
      `;
      document.head.appendChild(styleElement);
      document.body.appendChild(box);
      document.addEventListener('mousemove', event => {
        box.style.left = event.pageX + 'px';
        box.style.top = event.pageY + 'px';
        updateButtons(event.buttons);
      }, true);
      document.addEventListener('mousedown', event => {
        updateButtons(event.buttons);
        box.classList.add('button-' + event.which);
      }, true);
      document.addEventListener('mouseup', event => {
        updateButtons(event.buttons);
        box.classList.remove('button-' + event.which);
      }, true);
      function updateButtons(buttons) {
        for (let i = 0; i < 5; i++)
          box.classList.toggle('button-' + i, buttons & (1 << i));
      }
    }, false);
  });
};

const navigateToPlayerPage = async (page, playerName) => {
  const searchBarSelector = 'pierce/.stats-search__icon'
  const searchBarNode = await page.waitForSelector(searchBarSelector);
  await searchBarNode.click()
  await page.waitForSelector('pierce/.nav-inner__search.nav-inner__search--right.stats-search.active')
  await page.keyboard.type(playerName)

  const playerSearchResultSelector = playerName.match("'") ? `xpath///a[contains(., '${playerName.split("'")[1]}')]` : `xpath///a[contains(., '${playerName}')]`
  await page.waitForSelector(playerSearchResultSelector, { timeout: 4000 })
  await page.click(playerSearchResultSelector)
  // const playerSearchResultsSelector = 'pierce/.stats-search__link-anchor'
  // const results = page.waitForSelector(playerSearchResultsSelector)
  // await page.click(results[0])
  await page.waitForSelector(`text/Profile`)

  await new Promise(resolve => setTimeout(resolve, 3000))

  const filterSelector = "pierce/select[name='SeasonType']"
  const filter = await page.waitForSelector(filterSelector)
  await filter.hover()
  await filter.focus()
  await page.keyboard.press('ArrowUp')
  await page.waitForSelector('text/Regular Season')
  await page.keyboard.type('Regu')
  await page.keyboard.press('Enter')

  await new Promise(resolve => setTimeout(resolve, 5000))
}

const tweakName = (playerName) => {
  switch(playerName) {
    case 'Imani McGee Stafford':
      return 'Imani McGee-Stafford'
    case 'Azura Stevens':
      return 'Azurá Stevens'
    case 'AD':
      return 'Asia (AD) Durr'
    default:
      return playerName
  }
}

const getStatsForPlayer = async (page, playerName, stats, year, opts) => {
  const { useCaching } = opts

  let cachedStats
  if (useCaching) {
    cachedStats = await getStatsFromCache(
      playerName,
      stats,
      `${__dirname}/cachedPlayerStats-${year}`,
      { skipIfStatsMissing: false, cacheValidHours: 2000000000 }
    )
  }
  if (cachedStats) { return cachedStats }

  const scrapedStats = await scrapeStatsForPlayer(page, tweakName(playerName), stats, year, opts)

  if (useCaching) {
    await cachePlayerStats(playerName, scrapedStats, getCachedPlayerStatsPath(playerName, `${__dirname}/cachedPlayerStats-${year}`));
  }

  return scrapedStats
}

const convertHTMLTableToHash = async (tableNode, year) => {
  const headings = await tableNode.evaluate((node) => {
    return Array.from(node.querySelectorAll('th')).map(th => th.innerText.trim())
  })

  const textRows = await tableNode.$eval('tbody', (tbodyNode) => {
    return Array.from(tbodyNode.rows).map((tr) => {
      return Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())
    })
  })

  const yearRegExp = new RegExp(year)
  const yearIndex = textRows
    .map((row) => row[0])
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
    const statLabel = STAT_INFO[stat].WNBA.LABEL.toLowerCase()
    memo[stat] = statsHash[statLabel] || memo[stat]
    return memo;
  }
}

const scrapeBasicStats = async (page, stats, year, memo={}) => {
  const label = 'Traditional Splits'
  const statsHash = await getStatsHashFromTableWithLabel(page, label, year)
  return stats.reduce(addStatsToMemoFrom(statsHash), { ...memo });
}

const scrapeAdvancedStats = async (page, stats, year, memo={}) => {
  const label = 'Advanced Splits'
  const statsHash = await getStatsHashFromTableWithLabel(page, label, year)
  return stats.reduce(addStatsToMemoFrom(statsHash), { ...memo });
}

const getStatsHashFromTableWithLabel = async (page, label, year) => {
  const tableSelector = `xpath///*[contains(@class, 'nba-stat-table__caption')  and contains(., '${label}')]/following-sibling::nba-stat-table//table`
  try {
    const tableNode = await page.waitForSelector(tableSelector, { timeout: 10_000 })
    return await convertHTMLTableToHash(tableNode, year)
  } catch(error) {
    console.log(error)
    console.log(`No stats found for this player for ${year}`)
    return {}
  }
}

const scrapeStatsForPlayer = async (page, playerName, stats, year, opts= {}) => {
  const { url } = { ...DEFAULT_OPTS, ...opts }

  await new Promise(resolve => setTimeout(resolve, 2_000))
  try {
    await navigateToPlayerPage(page, playerName)
    const statsObj = await scrapeBasicStats(page, stats, year)
    return await scrapeAdvancedStats(page, stats, year, statsObj)
  } catch(err) {
    console.log(err)
    page.goto(url)
    return {}
  }
}

const runInBrowser = async (url, callback, opts={}) => {
  const browser = await puppeteer.launch(opts)
  const page = await browser.newPage()
  await installMouseHelper(page)
  await page.goto(url)
  await page.setViewport({ width: 1366, height: 768})
  const results = await callback(page)
  await browser.close()
  return results
}

const dismissCookiePolicy = async (page) => {
  await page.waitForSelector('text/Cookie Policy')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
}

const scrape = async (playerNames, { statList, year }, opts = {}) => {
  const { url, useCaching } = { ...DEFAULT_OPTS, ...opts }

  return await runInBrowser(url, async (page) => {
    await dismissCookiePolicy(page)
    const playerStats = await playerNames.reduce(async (accumulatedStatsPromise, playerName) => {
      const list = await accumulatedStatsPromise
      try {
        list.push(await getStatsForPlayer(page, playerName, statList, year, { url, useCaching }))
      } catch (err) {
        throw `Stats fetching for ${playerName} failed with the following message: ${err}`
      }

      return list
    }, Promise.resolve([]))
    return playerStats
  }, { headless: false })
}

module.exports = { scrape }
