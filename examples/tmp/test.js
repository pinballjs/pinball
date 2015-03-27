'use strict';

let co         = require('co');
let prettyjson = require('prettyjson');
let promise    = require('bluebird');
let ProtoBuf   = require('protobufjs');
let builder    = ProtoBuf.loadProtoFile('helloworld.proto');
let root       = builder.build();

// let metadata = new root.Metadata();
// let cmd = new root.SalestaxCalculateCmd(1, metadata);

// for (let k in cmd) {
//   console.log(k);
// }
// let reply = new root.SalestaxCalculateCmd(2, metadata, 120);

// console.log(root.PeekSchema.decode(reply.toBuffer()));

for (let k in builder) {
  console.log(k);
}
console.log(builder.files);

// let error = new root.ErrorEvent({
//   metadata: {
//     error: {
//       name: 'foo',
//       message: 'msg',
//       stack: 'stack'
//     }
//   }
// });
// console.log(error);
