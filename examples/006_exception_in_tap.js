'use strict';

/**
 * README
 * A tap can thow an Error that is sent to bus for monitoring purpose
 * and it doesn't affect the other microservices.
 *
 * DEBUG=pinball:transport node 006_exception_in_tap.js
 */
let co         = require('co');
let pinball    = require('..')('example');
let prettyjson = require('prettyjson');
require('colors');

/**
 * add a transport
 * eventemitter is a local transport for testing
 * services and consumers in the same nodejs process
 * then add a microservice (you can chain method add)
 */
pinball.use('eventemitter');
pinball.add({ role:'salestax', cmd:'calculate' }, calculate);
pinball.add({ role:'salestax', cmd:'calculate' }, { tap: true }, observe);

/**
 * a microservice is a generator
 * you need to return a reply
 */
function *calculate(done) {
  done({ role:'salestax', reply:'calculate', total: this.net * 1.2 });
}

function *observe() {
  throw new CustomError('This is a custom error');
}

function CustomError(message) {
  Error.call(this);
  Error.captureStackTrace(this, CustomError);
  this.message = message;
  this.name = 'CustomError';
}
CustomError.prototype = Object.create(Error.prototype);

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
  console.log('message is:'.red);
  console.log(prettyjson.render(msg));

  // yield because it's a promise
  let reply = yield pinball.act(msg);

  console.log('\nreply is:'.red);
  console.log(prettyjson.render(pinball.clean(reply)));
});
