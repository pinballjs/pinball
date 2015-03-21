'use strict';

let co         = require('co');
let pinball    = require('../..')('example');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let ProtoBuf   = require('protobufjs');
let builder    = ProtoBuf.loadProtoFile('helloworld.proto');
let Helloworld = builder.build('Helloworld');
require('colors');

let options = {
  decode: decode(Helloworld),
  encode: encode(Helloworld)
};
// add a transport
// jshint camelcase: false
pinball.use('redis', options, {return_buffers: true});
// jshint camelcase: true
// add a microservice
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
});

function encode(pkg) {
  let SalestaxCalculate = pkg.SalestaxCalculate;
  return function (msg) {
    try {
      console.log();
      console.log('JSON'.yellow, `${ JSON.stringify(msg).length } bytes`);
      console.log('PB'.blue, `${ new SalestaxCalculate(replaceAt(msg)).toBuffer().length } bytes`);
      return new SalestaxCalculate(replaceAt(msg)).toBuffer();
    } catch(e) {
      console.log(e.stack);
    }
  };
}

function decode(pkg) {
  let SalestaxCalculate = pkg.SalestaxCalculate;
  return function (msg) {
    try {
      let reply = SalestaxCalculate.decode(msg);
      return replacePinballAndLong(reply);
    } catch(e) {
      console.log(e.stack);
    }
  };
}

function replaceAt(msg) {
  let newMsg = {};
  for (let key in msg) {
    newMsg[key.replace('@', 'pinball_')] = msg[key];
  }
  return newMsg;
}

function replacePinballAndLong(msg) {
  let newMsg = {};
  for (let key in msg) {
    if (typeof msg[key] !== 'function') {
      let newKey = key.replace('pinball_', '@');
      if (ProtoBuf.Long.isLong(msg[key])) {
        newMsg[newKey] = msg[key].toNumber();
      } else {
        newMsg[newKey] = msg[key];
      }
    }
  }
  return newMsg;
}
