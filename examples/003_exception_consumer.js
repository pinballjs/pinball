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

    let reply = yield plato.act(msg, 50);

    console.log('\nreply is:'.red);
    console.log(prettyjson.render(plato.clean(reply)));
  } catch(e) {
    console.log(e.stack);
  }

  plato.close();
});

// a microservice is a generator
function *calculate(act, pub) {
  try {
    yield act({ msg:'This is going to timeout in 100ms'}, 100);
  } catch(e) {
    // too late, becuse the consumer wanted a reply within 50ms
  }
  yield pub({msg: 'Broadcast some information'});

  return { role:'salestax', reply:'calculate', total: this.net * 1.2 };
}
