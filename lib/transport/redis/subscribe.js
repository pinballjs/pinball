'use strict';

let Promise = require('bluebird');
let co      = require('co');
let redis   = require('redis');
let events  = require('events');
let util    = require('util');

module.exports = function(topic, args) {
  return new RedisSubscribe(topic, args);
};

function RedisSubscribe(topic, args) {
  events.EventEmitter.call(this);
  this.reconnect = true;
  this.topic = topic;
  this.args = args;
  this._createClient();
}

util.inherits(RedisSubscribe, events.EventEmitter);

RedisSubscribe.prototype._error = function() {
};

RedisSubscribe.prototype._ready = function() {
  this.ready = true;
};

RedisSubscribe.prototype._end = function() {
  this._close();
  if (this.reconnect) {
    let self = this;
    co(function *() {
      yield Promise.delay(1000);
      self._createClient();
    });
  }
};

RedisSubscribe.prototype.close = function() {
  this.reconnect = false;
  this._close();
};

RedisSubscribe.prototype._close= function() {
  this.ready = false;
  this.client.end();
  this.client.removeAllListeners('error');
  this.client.removeAllListeners('ready');
  this.client.removeAllListeners('end');
  this.client.removeAllListeners('message');
  this.client.removeAllListeners('subscribe');
};

RedisSubscribe.prototype._createClient = function() {
  let self = this;
  this.client = redis.createClient.apply(redis, this.args);
  this.client.on('error', this._error.bind(this));
  this.client.once('ready', this._ready.bind(this));
  this.client.once('end', this._end.bind(this));
  this.client.on('message', function(channel, message) {
    self.emit('message', channel, message);
  });
  this.client.on('subscribe', function() {
    self.emit('subscribe');
  });
  this.client.subscribe(this.topic);
};
