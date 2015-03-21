'use strict';

let co         = require('co');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let pson       = require('pson');
let Measured   = require('measured');
let stats      = Measured.createCollection();

let read  = 0;
let write = 0;

let pinball = require('../..')();

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

// jshint camelcase: false
pinball.use('redis', options, {return_buffers: true});
// jshint camelcase: true
pinball.add({ role:'echo' }, echo);

function *echo(done) {
  stats.meter('requestsPerSecond').mark();
  done({ role:'echo', reply:this.value });
}

co(function *() {
  for(;;) {
    yield promise.delay(1000);
    console.log(prettyjson.render(stats.toJSON()));
    console.log(prettyjson.render({ 'read MB/s': read / 1024 / 1024, 'write MB/s': write / 1024 / 1024 }));
    read = write = 0;
  }
});

function encode(dict) {
  let pair = new pson.StaticPair(dict);
  return function (msg) {
    let buf = pair.toBuffer(msg);
    write = write + buf.length;
    return buf;
  };
}

function decode(dict) {
  let pair = new pson.StaticPair(dict);
  return function (msg) {
    read = read + msg.length;
    return pair.decode(msg);
  };
}
