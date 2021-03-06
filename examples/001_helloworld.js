'use strict';

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
pinball.use('eventemitter')
       .add({ role:'salestax', cmd:'calculate' }, calculate);

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
  console.log('message is:'.red);
  console.log(prettyjson.render(msg));

  // yield because it's a promise
  let reply = yield pinball.act(msg);

  console.log('\nreply is:'.red);
  console.log(prettyjson.render(pinball.clean(reply)));
});

