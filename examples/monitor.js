'use strict';

let redis  = require('redis');
let client = redis.createClient();
let pj     = require('prettyjson');

client.on('message', function(channel, message) {
  console.log(pj.renderString(message));
  console.log('============================================');
});

client.subscribe('pinball');
