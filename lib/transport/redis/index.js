'use strict';

let util      = require('util');
let events    = require('events');
let publish   = require('./publish');
let subscribe = require('./subscribe');
let debug     = require('debug')('pinball:transport');

module.exports = transport;

function transport() {
  return new Transport(Array.prototype.slice.call(arguments));
}

function Transport(args) {
  events.EventEmitter.call(this);
  let self = this;
  this.name = 'redis';
  this._pub = publish('pinball', args);
  this._sub = subscribe('pinball', args);
  this._sub.on('message', function(channel, message) {
    self.emit('event', JSON.parse(message));
  });
}

util.inherits(Transport, events.EventEmitter);

Transport.prototype.publish = function(event) {
  debug('publish event %o', event);
  return this._pub.publish(JSON.stringify(event));
};

Transport.prototype.close = function() {
  this._pub.close();
  this._sub.close();
};
