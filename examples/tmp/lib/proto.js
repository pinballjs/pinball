'use strict';

let _        = require('lodash');
let ProtoBuf = require('protobufjs');
ProtoBuf.populateAccessors = false;

module.exports = function(opts) {
  ProtoBuf.loadProto
  return {};

  function encode(root, prefix) {
    return function (msg) {
      let schemaId = getSchemaId(msg, prefix);
      if (schemaId !== null) {
        let klass;
        if (schemaId === 1) {
          klass = root.ErrorMsg.Metadata;
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
      return 'ErrorMsg';
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
};
