'use strict';

let co         = require('co');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let stats      = require('measured').createCollection();

let read  = 0;
let write = 0;

let pinball = require('../..')();

let options = {
  decode: decode,
  encode: encode
};

pinball.use('redis', options);
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

function encode(msg) {
  let buf = JSON.stringify(msg);
  write = write + buf.length;
  return buf;
}

function decode(msg) {
  read = read + msg.length;
  return JSON.parse(msg);
}
