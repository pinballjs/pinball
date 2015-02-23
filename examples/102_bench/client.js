'use strict';

let pinball    = require('../..')();
let co         = require('co');
let prettyjson = require('prettyjson');
let Promise    = require('bluebird');
let Measured   = require('measured');
let timer      = new Measured.Timer();

pinball.use('redis');

co(function *() {
  let counter = 0;
  yield Promise.delay(10);
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
    yield Promise.delay(1000);
    console.log(prettyjson.render(timer.toJSON()));
  }
});
