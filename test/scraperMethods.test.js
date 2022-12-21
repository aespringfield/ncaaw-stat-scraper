const assert = require('assert')
const path = require('path')
const scraperMethods = require('../lib')

describe('scraperMethods', () => {
  describe('#getSuffixForYear', () => {
      it('gets suffix for year', () => {
        console.log(path.dirname('.'))

        assert.equal(scraperMethods.getSuffixForYear(2023)).toBe('9486-12df17ae4e1e')
      })
  })
})