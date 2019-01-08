#!/usr/bin/env node

const program = require('commander');
const { populateFrom } = require('../lib/populateMethods');
const config = require('../lib/config');

program
    .version('0.0.1')
    .command('populate [source]')
    .action((source) => {
        console.log(source || 'Heyyy')
    })
    .parse(process.argv)

// populateFrom(config.SOURCE);