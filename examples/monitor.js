'use strict';

let argv = require('yargs')
  .usage('Monitor redis topic')
  .default('h', 'localhost')
  .default('p', 6379)
  .default('c', 'pinball')
  .alias('h', 'host')
  .alias('p', 'port')
  .alias('c', 'channel')
  .describe('p', 'Port')
  .describe('h', 'Host')
  .describe('c', 'Channel')
  .help('help')
  .argv;

let redis  = require('redis');
let client = redis.createClient(argv.port, argv.host);
let pj     = require('prettyjson');
let tty    = require('tty');
let json   = !tty.isatty(1);

client.on('message', function(channel, message) {
  if (json) {
    console.log(message);
  } else {
    console.log(pj.renderString(message));
    console.log('============================================');
  }
});

client.subscribe(argv.channel);
