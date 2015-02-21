'use strict';

let Promise = require('bluebird');
let co      = require('co');
let redis   = require('redis');

module.exports = function(topic, args) {
  return new RedisPublish(topic, args);
};

function RedisPublish(topic, args) {
  this.reconnect = true;
  this.topic = topic;
  this.args = args;
  this._createClient();
}

RedisPublish.prototype._error = function() {
};

RedisPublish.prototype._ready = function() {
  this.ready = true;
};

RedisPublish.prototype._end = function() {
  this._close();
  if (this.reconnect) {
    let self = this;
    co(function *() {
      yield Promise.delay(1000);
      self._createClient();
    });
  }
};

RedisPublish.prototype.close = function() {
  this.reconnect = false;
  this._close();
};

RedisPublish.prototype._close= function() {
  this.ready = false;
  this.client.end();
  this.client.removeAllListeners('error');
  this.client.removeAllListeners('ready');
  this.client.removeAllListeners('end');
};

RedisPublish.prototype._createClient = function() {
  this.client = redis.createClient.apply(redis, this.args);
  this.client.on('error', this._error.bind(this));
  this.client.once('ready', this._ready.bind(this));
  this.client.once('end', this._end.bind(this));
};

RedisPublish.prototype.publish = function(msg) {
  if (this.ready) {
    this.client.publish(this.topic, msg);
    return Promise.resolve('Success redis-publish');
  } else {
    return Promise.reject(new Error('Failure redis-publish'));
  }
};
