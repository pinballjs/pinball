'use strict';

global.NODE_ENV = process.env.NODE_ENV || 'development';

let app     = 'status';
let node    = process.env.NODE || 'status01';
let semver  = process.env.SEMVER || '0.0.1';
let pinball = require('../..')(app, node, semver);
let act     = pinball.act.bind(pinball);
let pub     = pinball.pub.bind(pinball);
let status  = require('./lib/github/status');
let log     = require('debug')('app:log');
require('./lib/metrics')(pub, 10000);

log(`${ app } version ${ semver } started`);

pinball.use('redis', {}, 6379, 'localhost');

// source of events
status(act, pub);
