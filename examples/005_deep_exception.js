'use strict';

let co         = require('co');
let pinball    = require('..')();
require('colors');

// add a transport
pinball.use('eventemitter');
// add a microservice
pinball.add({ role:'first', cmd:'cmd' }, first);
pinball.add({ role:'second', cmd:'cmd' }, second);
pinball.add({ role:'third', cmd:'cmd' }, third);

// consumer of a microservice
co(function *start() {
  try {
    yield pinball.act({ role:'first', cmd:'cmd' });
  } catch(e) {
    console.log(e);
    console.log(e.stack);
  }
  pinball.close();
});

// a microservice is a generator
function *first(done, act) {
  yield act({ role:'second', cmd:'cmd' });
}

// a microservice is a generator
function *second(done, act) {
  yield act({ role:'third', cmd:'cmd' });
}

function *third() {
  throw new CustomError('This is a custom error');
}

function CustomError(message) {
  Error.call(this);
  Error.captureStackTrace(this, CustomError);
  this.message = message;
  this.name = 'CustomError';
}
CustomError.prototype = Object.create(Error.prototype);
