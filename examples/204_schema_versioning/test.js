'use strict';

let ProtoBuf   = require('protobufjs');
let builder    = ProtoBuf.newBuilder({populateAccessors: false});
ProtoBuf.loadProtoFile('pinball.proto', builder);
ProtoBuf.loadProtoFile('helloworld.proto', builder);
let root       = builder.build();
// let metadata = new root.Metadata();
// let cmd = new root.SalestaxCalculateCmd(1, metadata);

// for (let k in cmd) {
//   console.log(k);
// }
// let reply = new root.SalestaxCalculateCmd(2, metadata, 120);

// console.log(root.PeekSchema.decode(reply.toBuffer()));

// console.log(root);
// let error = new root.pinball.ErrorEvent({
//   metadata: {
//     error: {
//       name: 'foo',
//       message: 'msg',
//       stack: 'stack'
//     }
//   }
// });
// console.log(error);

// console.log(builder.lookup('pinball.ErrorEvent.schema').defaultValue);
// console.log(builder.lookup('helloworld.SalestaxCalculateCmd.schema').defaultValue);
// console.log(builder.lookup('helloworld.SalestaxCalculateCmd.metadata').resolvedType);
// console.log(builder.lookup('helloworld.SalestaxCalculateCmd.metadata').resolvedType.name);
// console.log(builder.lookup('helloworld.SalestaxCalculateCmd.metadata').resolvedType.parent.name);

let s = new root.pinball.PeekSchema(1, new Buffer(JSON.stringify({})));
console.log(s.toBuffer());
console.log(new Buffer(JSON.stringify({})));
