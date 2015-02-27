'use strict';

let co      = require('co');
let pinball = require('..')('example');
let promise = require('bluebird');

// add a transport
pinball.use('redis');
// add a microservice
pinball.add({ role:'first', cmd:'cmd' }, first);

// consumer of a microservice
co(function *start() {
  yield promise.delay(100);
  try {
    yield pinball.act({ role:'first', cmd:'cmd' }, 100);
  } catch(e) {
    console.log(e);
    console.log(e.stack);
  }
  yield promise.delay(1000);
  pinball.close();
});

// a microservice is a generator
function *first(done) {
  yield promise.delay(200);
  done({foo: 'BAR'});
}
