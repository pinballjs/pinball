'use strict';

let co         = require('co');
let pinball    = require('../..')('example');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let pson       = require('pson');
require('colors');

/**
 * This example shows how to use https://github.com/dcodeIO/PSON to encode and decode messages
 * Cmd:
 *   stringify 368 bytes
 *   pson 212 bytes
 * Reply:
 *   stringify 428 bytes
 *   pson 234 bytes
 */
let dictionary = [
  // domain keys
  'role',
  'cmd',
  'net',
  'reply',
  'total',
  // domain values
  'salestax',
  'calculate',
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
// add a transport
// jshint camelcase: false
pinball.use('redis', options, {return_buffers: true});
// jshint camelcase: true
// add a microservice
pinball.add({ role:'salestax', cmd:'calculate' }, calculate);

/**
 * a microservice is a generator
 * you need to return a reply
 */
function *calculate(done) {
  done({ role:'salestax', reply:'calculate', total: this.net * 1.2 });
}

// events are plain javascript objects
let msg = {
  role: 'salestax',
  cmd:  'calculate',
  net:  100
};

/**
 * consumer of salestax microservice
 * act returns a promise
 * we use co for control flow
 */
co(function *() {
  yield promise.delay(100);
  console.log('message is:'.red);
  console.log(prettyjson.render(msg));

  // yield because it's a promise
  let reply = yield pinball.act(msg);

  console.log('\nreply is:'.red);
  console.log(prettyjson.render(pinball.clean(reply)));
  pinball.close();
});

function encode(dict) {
  let pair = new pson.StaticPair(dict);
  return function (msg) {
    console.log();
    console.log('JSON'.yellow, `${ JSON.stringify(msg).length } bytes`);
    console.log('PSON'.blue,   `${ pair.toBuffer(msg).length } bytes`);
    return pair.toBuffer(msg);
  };
}

function decode(dict) {
  let pair = new pson.StaticPair(dict);
  return function (msg) {
    return pair.decode(msg);
  };
}
