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
       .add({ role:'disk', cmd:'check' }, disk);

/**
 * a microservice is a generator
 * you need to return a reply
 */
function *disk(done) {
  done();
}

// events are plain javascript objects
let msg = {
    role: 'disk',
    cmd:  'check',
    disk: 'sda'
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

  console.log('\nreply is empty'.red);
  console.log(prettyjson.render(pinball.clean(reply)));
});

