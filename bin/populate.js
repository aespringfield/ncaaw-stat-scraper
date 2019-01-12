#!/usr/bin/env node

const program = require('commander');
const { populateFrom } = require('../lib/populateMethods');
const config = require('../lib/config');

program
    .version('0.1.0')
    .option('-s, --source [site]', 'Source for scraping')
    .parse(process.argv);

 program
    .version('0.1.0')
    .command('populate [source]')
    .action((source) => {
        populateFrom(source.toUpperCase() || config.SOURCE);
    })

program.parse(process.argv);

if (program.source) {
    populateFrom(program.source.toUpperCase() || config.SOURCE);
}