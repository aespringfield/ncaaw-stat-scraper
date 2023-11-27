import { scrape } from '../../../scrapers/wnba/scraper.cjs';

describe('wnba scraper', () => {
  describe('scrape', () => {
    const opts = {
      useCaching: false
    }

    it('retrieves player data', async () => {
      const playerNames = ['Haley Jones'];
      const statList= [
        "WNBA_PPG",
        "WNBA_EFG%",
      ];
      const year = '2023';
      const results = await scrape(playerNames, { statList, year }, opts);
      expect(results).toEqual([
        {
          "WNBA_PPG": "3.7",
          "WNBA_EFG%": "35.5"
        }
      ]);
    }, 30_000)
  })
})
