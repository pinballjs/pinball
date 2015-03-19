'use strict';

let co         = require('co');
let pinball    = require('..')('example');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
require('colors');

// redis transport options
let options = {
  channel: 'test',
  encode: JSON.stringify,
  decode: JSON.parse
};

// add a transport
pinball.use('redis', options, 6379, 'localhost' );

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
}).catch(function(e) {
  console.log(e.stack);
});
