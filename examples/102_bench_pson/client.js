'use strict';

let pinball    = require('../..')();
let co         = require('co');
let Measured   = require('measured');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let pson       = require('pson');
let timer      = new Measured.Timer();

let dictionary = [
  // domain keys
  'role',
  'value',
  'reply',
  // pinball keys
  '@timestamp',
  '@uuid',
  '@txid',
  '@coid',
  '@reply',
  '@file',
  '@line',
  '@app',
  '@node',
  '@runid',
  '@semver',
  '@arity',
  '@ttl',
  '@noop',
  '@ftime',
  '@rtime',
  '@error',
  'stack',
  'name',
  'message'
];

let options = {
  decode: decode(dictionary),
  encode: encode(dictionary)
};

pinball.use('redis', options, {return_buffers: true});

co(function *() {
  let counter = 0;
  yield promise.delay(10);
  for(;;) {
    try {
      let stopwatch = timer.start();
      yield pinball.act({ role:'echo', value:counter++ }, 100, 1);
      stopwatch.end();
    } catch(e) {
      console.log(e);
    }
  }
});

co(function *() {
  for(;;) {
    yield promise.delay(1000);
    console.log(prettyjson.render(timer.toJSON()));
  }
});

function encode(dict) {
  let pair = new pson.StaticPair(dict);
  return function (msg) {
    return pair.toBuffer(msg);
  };
}

function decode(dict) {
  let pair = new pson.StaticPair(dict);
  return function (msg) {
    return pair.decode(msg);
  };
}
