'use strict';

let util      = require('util');
let events    = require('events');
let publish   = require('./publish');
let subscribe = require('./subscribe');
let debug     = require('debug')('pinball:transport');
let _         = require('lodash');

module.exports = transport;

function transport() {
  return new Transport(Array.prototype.slice.call(arguments));
}

function Transport(args) {
  let self = this;
  this.options = _.defaults(args.shift(), {
    channel: 'pinball',
    encode: JSON.stringify,
    decode: JSON.parse
  });
  events.EventEmitter.call(this);
  this.name = 'redis';
  this._pub = publish(this.options.channel, args);
  this._sub = subscribe(this.options.channel, args);
  this._sub.on('message', function(channel, message) {
    self.emit('event', self.options.decode(message));
  });
}

util.inherits(Transport, events.EventEmitter);

Transport.prototype.publish = function(event) {
  debug('publish event %o', event);
  return this._pub.publish(this.options.encode(event));
};

Transport.prototype.close = function() {
  this._pub.close();
  this._sub.close();
};
