'use strict';

let _       = require('lodash');
let co      = require('co');
let debug   = require('debug')('pinball');
let Promise = require('bluebird');
let util    = require('util');
let uuid    = require('node-uuid');

module.exports = pinball;

let transports = {
  eventemitter: './transport/eventemitter',
  redis:        './transport/redis'
};

function pinball() {
  return new Pinball();
}

function Pinball() {
  this.services = [];
  this.actions = {};
}

/**
 * Use a transport
 */
Pinball.prototype.use = function(transport) {
  let args = [];
  Array.prototype.push.apply(args, arguments);
  args.shift();
  if (transports[transport]) {
    transport = require(transports[transport]);
  } else {
    transport = require(`pinball-${ transport }`);
  }
  this.transport = transport.apply(null, args);
  debug('transport %o with args %o', this.transport.name, args);
  this.transport.on('event', this.dispatch.bind(this));
  return this;
};


/**
 * Add a micro service
 */
Pinball.prototype.add = function(pattern, options, generator) {
  if (!generator) {
    generator = options;
    options = {};
  }
  options = _.defaults(options, {
    noop: false,
    tap: false
  });
  options.arity = Object.keys(pattern).length;
  debug('add %o %o with options %o', generator.name, pattern, options);
  this.services.push({
    pattern: pattern,
    arity: options.arity,
    noop: options.noop,
    tap: options.tap,
    name: generator.name,
    generator: co.wrap(generator)
  });
  return this;
};

/**
 * Send a message and wait for a reply
 */
Pinball.prototype.act = function(msg, ttl, arity) {
  // we need two lines for act and Pinball.act
  let line = (new Error()).stack.split('\n', 4).slice(2,4).join('\n');
  ttl   = ttl || 1000;
  arity = arity || 2;
  debug('act %o with arity %o', msg, arity);
  let self = this;
  let _uuid = uuid.v4();
  msg._uuid  = _uuid;
  msg._coid  = msg._coid || _uuid;
  msg._arity = arity;
  msg._reply = false;
  msg._time  = Date.now();
  let result = new Promise(function(resolve, reject) {
    self.actions[_uuid] = {
      resolve: resolve,
      reject: reject,
      line: line
    };
  });
  let timeout = co(function *() {
    yield Promise.delay(ttl);
    let line = self.actions[_uuid].line;
    delete self.actions[_uuid];
    throw new PinballTimeoutError('Action timeout error', line);
  });
  return co(function *() {
    yield self.transport.publish(msg);
    return yield Promise.race([
      result,
      timeout
    ]);
  });
};

/**
 * Send a message, but don't wait for a reply
 */
Pinball.prototype.pub = function(msg, arity) {
  arity = arity || 2;
  debug('pub %o with arity %o', msg, arity);
  let _uuid = uuid.v4();
  msg._uuid  = _uuid;
  msg._coid  = msg._coid || _uuid;
  msg._arity = arity;
  msg._reply = false;
  msg._pub   = true;
  msg._time  = Date.now();
  return this.transport.publish(msg);
};

Pinball.prototype.close = function() {
  this.transport.close();
};

Pinball.prototype.dispatch = function(msg) {
  let callbacks = this.actions[msg._uuid] && this.actions[msg._uuid];
  debug('dispatch %o', msg);
  if (callbacks && msg._reply && !msg._noop) {
    if (!msg._error) {
      debug('resolve %o', msg);
      callbacks.resolve(msg);
    } else {
      debug('reject %o', msg);
      callbacks.reject(new PinballRemoteError(msg, callbacks.line));
    }
    delete this.actions[msg._uuid];
  }
  let services = this.route(msg);
  this.dispatchMatchOrNoop(services.match, msg, false);
  this.dispatchMatchOrNoop(services.noop, msg, true);
  this.dispatchTap(services.tap, msg);
};

/**
 * FIXME: create a better stacktrace that doesn't cut chain of Exceptions
 * in chained Microservices
 */
Pinball.prototype.dispatchMatchOrNoop = function(services, msg, noop) {
  let self = this;
  services.forEach(function(service) {
    service.generator.call(msg, act, pub).then(function(reply) {
      if (reply && !msg._pub) {
        reply._coid  = msg._coid;
        reply._uuid  = msg._uuid;
        reply._reply = true;
        reply._noop  = noop;
        reply._time  = Date.now();
        self.transport.publish(reply);
      }
    }).catch(function(e) {
      let reply = {};
      reply._coid  = msg._coid;
      reply._uuid  = msg._uuid;
      reply._reply = true;
      reply._noop  = noop;
      reply._time  = Date.now();
      reply._error = {
        stack: e.stack.split('\n', 2).slice(0,2).join('\n'),
        name: e.name,
        message: e.message
      };
      self.transport.publish(reply);
    });
  });
  function act() {
    let args = Array.prototype.slice.call(arguments, 0);
    args[0]._coid= msg._coid;
    return self.act.apply(self, args);
  }
  function pub() {
    let args = Array.prototype.slice.call(arguments, 0);
    args[0]._coid= msg._coid;
    return self.pub.apply(self, args);
  }
};

Pinball.prototype.dispatchTap = function(services, msg) {
  let self = this;
  services.forEach(function(service) {
    service.generator.call(msg, act, pub);
  });
  function act() {
    let args = Array.prototype.slice.call(arguments, 0);
    args[0]._coid= msg._coid;
    return self.act.apply(self, args);
  }
  function pub() {
    let args = Array.prototype.slice.call(arguments, 0);
    args[0]._coid= msg._coid;
    return self.pub.apply(self, args);
  }
};

/**
 * tap = ignore arity, it cannot send a reply
 * noop = this reply has to be ignored, because it is just a staging version of a microservice
 *
 * match:[], tap: [], noop: []
 *
 * { role: 'user', what: 'alberto' }
 */
Pinball.prototype.route = function(msg) {
  let res = { match: [], tap: [], noop: [] };
  this.services.forEach(function(service) {
    if (_.matches(service.pattern)(msg)) {
      if (msg._arity === service.arity && !service.tap) {
        if (service.noop) {
          debug('route noop service %o %o', service.name, service.pattern);
          res.noop.push(service);
        } else {
          debug('route match service %o %o', service.name, service.pattern);
          res.match.push(service);
        }
      }
      if (service.tap) {
        debug('route tap service %o %o', service.name, service.pattern);
        res.tap.push(service);
      }
    }
  });
  return res;
};

/**
 * Utility function to remove key starting with _
 */
Pinball.prototype.clean = function(reply) {
  let cleanReply= {};
  _.forOwn(reply, function(value, key) {
    if (key.charAt(0) !== '_') {
      cleanReply[key] = value;
    }
  });
  return cleanReply;
};

function PinballRemoteError(msg, line) {
  let error = msg._error;
  Error.call(this);
  Error.captureStackTrace(this, PinballRemoteError);
  this.message = error.message;
  this.stack = error.stack + '\nFrom previous event:\n' + line;
  this.name = error.name;
}

util.inherits(PinballRemoteError, Error);

function PinballTimeoutError(message, line) {
  Error.call(this);
  Error.captureStackTrace(this, PinballTimeoutError);
  this.message = message;
  this.stack = this.stack + '\nFrom previous event:\n' + line;
  this.name = 'PinballTimeoutError';
}

util.inherits(PinballTimeoutError, Error);
