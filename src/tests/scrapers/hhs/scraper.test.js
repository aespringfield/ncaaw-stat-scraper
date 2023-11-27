import { MockServer } from '../../support/mockServer.cjs';
import { scrape } from '../../../scrapers/hhs/scraper.cjs';

describe('hhs scraper', () => {
  beforeAll(async () => {
    // start mock server
    MockServer.start('herhoopstats.com');
  });

  afterAll(async () => {
    // stop mock server
    await MockServer.stop();
  })

  describe('scrape', () => {
    const opts = {
      url: MockServer.uri(),
      useCaching: false
    }

    it('retrieves player data', async () => {
      const playerNames = ['Haley Jones'];
      const statList= [
        "TOTAL_POINTS",
        "EFG%",
      ];
      const year = '2023';
      const results = await scrape(playerNames, { statList, year }, opts);
      expect(results).toEqual([
        {
          "TOTAL_POINTS": "13.5",
          "EFG%": "43.6%"
        }
      ]);
    }, 15_000)
  })
})
