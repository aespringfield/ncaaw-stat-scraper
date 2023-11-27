#!/usr/bin/env node

const program = require('commander');
const { populateFrom } = require('./src/populate.cjs');
const config = require('./src/config.json');

program
    .version('0.1.0')
    .option('-r, --rookies', 'Populate the rookie sheet instead')
    .option('-s, --source [site]', 'Set source [site]')
    .parse(process.argv);

//  program
//     .version('0.1.0')
//     .command('populate [source]')
//     .action((source) => {
//         console.log('second one')
//         // populateFrom(source.toUpperCase() || config.SOURCE);
//     })

// program.parse(process.argv);

populateFrom(program.source ? program.source.toUpperCase() : config.SOURCE);
