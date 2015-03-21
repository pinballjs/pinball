'use strict';

let debug  = require('debug')('pinball:transport');
let events = require('events');
let util   = require('util');

module.exports = transport;

function transport() {
  return new Transport();
}

function Transport() {
  events.EventEmitter.call(this);
  this.name = 'eventemitter';
}

util.inherits(Transport, events.EventEmitter);

Transport.prototype.publish = function(event) {
  let self = this;
  // simulated network delay
  setTimeout(function() {
    debug('publish event %o', event);
    self.emit('event', event);
  }, 10);
  return Promise.resolve();
  // return Promise.reject(new Error('broken transport'));
};

Transport.prototype.close = function(){};
