'use strict';

let co         = require('co');
let pinball    = require('..')();
let prettyjson = require('prettyjson');
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

    let reply = yield pinball.act(msg, 50);

    console.log('\nreply is:'.red);
    console.log(prettyjson.render(pinball.clean(reply)));
  } catch(e) {
    console.log(e.stack);
  }

  pinball.close();
});

// a microservice is a generator
function *calculate(done, act, pub) {
  try {
    yield act({ msg:'This is going to timeout in 100ms'}, 100);
  } catch(e) {
    // too late, becuse the consumer wanted a reply within 50ms
  }
  yield pub({msg: 'Broadcast some information'});

  done({ role:'salestax', reply:'calculate', total: this.net * 1.2 });
}
