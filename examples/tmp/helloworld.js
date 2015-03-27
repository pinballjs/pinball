'use strict';

let co         = require('co');
let pinball    = require('../..')('example');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let ProtoBuf   = require('protobufjs');
ProtoBuf.populateAccessors = false;
let builder    = ProtoBuf.loadProtoFile('helloworld.proto');
let root       = builder.build();
require('colors');

let options = {
  decode: decode(root, '@'),
  encode: encode(root, '@')
};
// add a transport
// jshint camelcase: false
pinball.use('redis', options, {return_buffers: true});
// jshint camelcase: true
// add a microservice
pinball.add({ schema:10 }, calculate);

/**
 * a microservice is a generator
 * you need to return a reply
 */
function *calculate(done) {
  done({ schema:11, total: this.net * 1.2 });
}

// events are plain javascript objects
let msg = {
  schema: 10,
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
  let reply = yield pinball.act(msg, 1000, 1);

  console.log('\nreply is:'.red);
  console.log(prettyjson.render(pinball.clean(reply)));
  pinball.close();
}).catch(function(e) {
  console.log(e.stack);
  pinball.close();
});

function encode(root, prefix) {
  return function (msg) {
    let schemaId = getSchemaId(msg, prefix);
    if (schemaId !== null) {
      let klass;
      if (schemaId === 1) {
        klass = root.ErrorEvent.Metadata;
      } else {
        klass = root.Metadata;
      }
      let metadata = createMetadata(klass, msg, prefix);
      let protoMsg = new root[schemaIdToName(schemaId)](schemaId, metadata);
      mergeData(protoMsg, msg, prefix);
      return protoMsg.toBuffer();
    } else {
      throw new Error('Missing schema id');
    }
  };
}

function getSchemaId(msg, prefix) {
  if (msg.schema) {
    return msg.schema;
  } else if (msg[`${ prefix }error`]) {
    return 1;
  } else {
    return null;
  }
}

function decode(root, prefix) {
  return function (msg) {
    let schemaId = root.PeekSchema.decode(msg).schema;
    let protoMsg = root[schemaIdToName(schemaId)].decode(msg);
    return protoMsgToMsg(protoMsg, prefix);
  };
}

function protoMsgToMsg(protoMsg, prefix) {
  let msg = {};
  for (let key in protoMsg) {
    if (typeof protoMsg[key] !== 'function') {
      if (key === 'metadata') {
        let metadata = protoMsg[key];
        for (let innerKey in metadata) {
          if (typeof metadata[innerKey] !== 'function') {
            msg[`${ prefix }${ innerKey }`] = convertLong(metadata[innerKey]);
          }
        }
      } else {
        msg[key] = convertLong(protoMsg[key]);
      }
    }
  }
  return msg;
}

function convertLong(value) {
  if (ProtoBuf.Long.isLong(value)) {
    return value.toNumber();
  } else {
    return value;
  }
}

function mergeData(protoMsg, msg, prefix) {
  for (let key in msg) {
    if (key.charAt(0) !== prefix && key !== 'schema') {
      protoMsg[key] = msg[key];
    }
  }
}

function schemaIdToName(id) {
  if (id === 10) {
    return 'SalestaxCalculateCmd';
  } else if (id === 11) {
    return 'SalestaxCalculateReply';
  } else if (id === 1) {
    return 'ErrorEvent';
  }
}

function createMetadata(Metadata, msg, prefix) {
  let metadata = {};
  for (let key in msg) {
    if (key.charAt(0) === prefix) {
      metadata[key.replace(prefix, '')] = msg[key];
    }
  }
  return new Metadata(metadata);
}
