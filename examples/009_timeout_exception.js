'use strict';

let co      = require('co');
let pinball = require('..')('example');
let promise = require('bluebird');

// add a transport
pinball.use('redis');
// add a microservice
pinball.add({ role:'first', cmd:'cmd' }, first);
pinball.add({ role:'second', cmd:'cmd' }, second);
pinball.add({ role:'third', cmd:'cmd' }, third);

// consumer of a microservice
co(function *start() {
  yield promise.delay(100);
  try {
    yield pinball.act({ role:'first', cmd:'cmd' }, 200);
  } catch(e) {
    console.log(e);
    console.log(e.stack);
  }
  yield promise.delay(1000);
  pinball.close();
});

// a microservice is a generator
function *first(done, act) {
  done(yield act({ role:'second', cmd:'cmd' }, 150));
}

// a microservice is a generator
function *second(done, act) {
  done(yield act({ role:'third', cmd:'cmd' }, 100));
}

function *third(done) {
  yield promise.delay(300);
  done({foo: 'BAR'});
}

function CustomError(message) {
  Error.call(this);
  Error.captureStackTrace(this, CustomError);
  this.message = message;
  this.name = 'CustomError';
}
CustomError.prototype = Object.create(Error.prototype);
