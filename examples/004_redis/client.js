'use strict';

let pinball    = require('../..')();
let co         = require('co');
let prettyjson = require('prettyjson');
let Promise    = require('bluebird');
require('colors');

pinball.use('redis');

let msg = {
    role: 'salestax',
    cmd:  'calculate',
    net:  100
};

co(function *() {
  // redis transport is not ready at this point
  yield Promise.delay(100);
  console.log('message is:'.red);
  console.log(prettyjson.render(msg));

  try {

    let reply = yield pinball.act(msg);

    console.log('\nreply is:'.red);
    console.log(prettyjson.render(pinball.clean(reply)));
  } catch(e) {
    console.error(e.stack);
  }
  pinball.close();
});
