'use strict';

let co         = require('co');
let plato      = require('..')();
let prettyjson = require('prettyjson');
let Promise    = require('bluebird');
require('colors');

// add a transport
plato.use('eventemitter');
// add a microservice
plato.add({ role:'salestax', cmd:'calculate' }, calculate);

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

    let reply = yield plato.act(msg);

    console.log('\nreply is:'.red);
    console.log(prettyjson.render(plato.clean(reply)));
  } catch(e) {
    // it will never happen.
  }

  plato.close();
});

// a microservice is a generator
function *calculate(act, pub) {
  try {
    yield act({ msg:'This is going to timeout in 100ms'}, 100);
  } catch(e) {
    // there is no service answering this message, but we timout
    // before the consumer.
    // The consumer is using the default timeout that is 1000ms
    console.log(e.stack);
  }
  yield pub({msg: 'Broadcast some information'});

  return { role:'salestax', reply:'calculate', total: this.net * 1.2 };
}
