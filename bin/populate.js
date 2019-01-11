#!/usr/bin/env node

const program = require('commander');
const { populateFrom } = require('../lib/populateMethods');
const config = require('../lib/config');

program
    .version('0.1.0')
    .option('-s, --source [site]', 'Source for scraping')
    .parse(process.argv);

populateFrom(program.source.toUpperCase() || config.SOURCE);