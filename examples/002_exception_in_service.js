'use strict';

let co         = require('co');
let pinball    = require('..')();
let prettyjson = require('prettyjson');
let Promise    = require('bluebird');
require('colors');

// add a transport
pinball.use('eventemitter');
// add a microservice
pinball.add({ role:'salestax', cmd:'calculate' }, calculate);

let msg = {
    role: 'salestax',
    cmd:  'calculate',
    net:  100
};

// consumer of a microservice
co(function *() {
  console.log('message is:'.red);
  console.log(prettyjson.render(msg));

  try {

    let reply = yield pinball.act(msg);

    console.log('\nreply is:'.red);
    console.log(prettyjson.render(pinball.clean(reply)));
  } catch(e) {
    // it will never happen.
  }

  pinball.close();
});

// a microservice is a generator
function *calculate(done, act, pub) {
  try {
    yield act({ msg:'This is going to timeout in 100ms'}, 100);
  } catch(e) {
    // there is no service answering this message, but we timout
    // before the consumer.
    // The consumer is using the default timeout that is 1000ms
    console.log(e.stack);
  }
  yield pub({msg: 'Broadcast some information'});

  done({ role:'salestax', reply:'calculate', total: this.net * 1.2 });
}
