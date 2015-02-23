'use strict';

let co         = require('co');
let prettyjson = require('prettyjson');
let Promise    = require('bluebird');
let stats      = require('measured').createCollection();

let pinball = require('../..')();

pinball.use('redis')
       .add({ role:'echo' }, echo);

function *echo() {
  stats.meter('requestsPerSecond').mark();
  return { role:'echo', reply:this.value };
}

co(function *() {
  for(;;) {
    yield Promise.delay(1000);
    console.log(prettyjson.render(stats.toJSON()));
  }
});
