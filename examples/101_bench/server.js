'use strict';

let co         = require('co');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let stats      = require('measured').createCollection();

let pinball = require('../..')();

pinball.use('redis')
       .add({ role:'echo' }, echo);

function *echo(done) {
  stats.meter('requestsPerSecond').mark();
  done({ role:'echo', reply:this.value });
}

co(function *() {
  for(;;) {
    yield promise.delay(1000);
    console.log(prettyjson.render(stats.toJSON()));
  }
});
