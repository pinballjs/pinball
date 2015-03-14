'use strict';

let _       = require('lodash');
let co      = require('co');
let debug   = require('debug')('pinball');
let Promise = require('bluebird');
let uuid    = require('node-uuid');
let stack   = require('callsite');
let path    = require('path');
let root    = path.dirname(require.main.filename);

module.exports = pinball;

let transports = {
  eventemitter: './transport/eventemitter',
  redis:        './transport/redis'
};

function pinball(app, node, semver) {
  return new Pinball(app, node, semver);
}

function Pinball(app, node, semver) {
  this.app    = app || 'app';
  this.node   = node || 'default';
  this.semver = semver|| '0.0.1';
  this.runid = Math.floor(Math.random() * Math.pow(2,53));
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
  ttl   = ttl || 1000;
  arity = arity || 2;
  debug('act %o with arity %o', msg, arity);
  let line = this.enrichMessage(msg, stack());
  let self = this;
  let _txid = msg._txid;
  msg._arity = arity;
  msg._ttl   = ttl;
  let result = new Promise(function(resolve, reject) {
    self.actions[_txid] = {
      resolve: resolve,
      reject: reject,
      line: line
    };
  });
  let timeout = co(function *() {
    yield Promise.delay(ttl);
    let line = self.actions[_txid].line;
    delete self.actions[_txid];
    let e = new PinballTimeoutError('Action timeout error', line);
    if (msg._txid === msg._coid) {
      let error = {};
      self.prepareError(error, msg, e);
      self.transport.publish(error);
    }
    throw e;
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
 * Enrich message and return line for long stacktraces
 */
Pinball.prototype.enrichMessage = function(msg, stack) {
  let line;
  let _txid = uuid.v4();
  msg._uuid  = _txid;
  msg._txid  = _txid;
  msg._coid  = msg._coid || _txid;
  msg._reply = false;
  msg._time  = Date.now();
  for (let site of stack) {
    let _file = site.getFileName();
    msg._file = _file.replace(new RegExp('^' + root), '');
    if (module.id !== site.getFileName()) {
      let _func = site.getFunctionName();
      if (_func) {
        msg._func = _func;
      }
      msg._line = site.getLineNumber();
      line = `    at ${ msg._func || 'anonymous' } (${ _file }:${ msg._line }`;
      break;
    }
  }
  this.addAppInfo(msg);
  return line;
};

/**
 * app    is application name
 * node   is node name in clustered application
 * runid  is an identifier to catch operational problems, like two running instances instead of one or restarts.
 * semver is http://semver.org/
 */
Pinball.prototype.addAppInfo = function(msg) {
  msg._app    = this.app;
  msg._node   = this.node;
  msg._runid  = this.runid;
  msg._semver = this.semver;
};

/**
 * Send a message, but don't wait for a reply
 */
Pinball.prototype.pub = function(msg, arity) {
  arity = arity || 2;
  debug('pub %o with arity %o', msg, arity);
  this.enrichMessage(msg, stack());
  msg._arity = arity;
  msg._pub   = true;
  return this.transport.publish(msg);
};

Pinball.prototype.close = function() {
  this.transport.close();
};

Pinball.prototype.prepareError = function(error, msg, e) {
  error._uuid  = uuid.v4();
  error._coid  = msg._coid;
  error._txid  = error._uuid;
  error._reply = false;
  error._pub   = true;
  error._time  = Date.now();
  error._error = {
    stack: e.stack,
    name: e.name,
    message: e.message
  };
  this.addAppInfo(error);
};

Pinball.prototype.dispatch = function(msg) {
  let callback = this.actions[msg._txid];
  debug('dispatch %o', msg);
  if (callback && msg._reply && !msg._noop) {
    if (!msg._error) {
      debug('resolve %o', msg);
      callback.resolve(msg);
    } else {
      debug('reject %o', msg);
      let e = new PinballRemoteError(msg, callback.line);
      if (msg._txid === msg._coid) {
        let error = {};
        this.prepareError(error, msg, e);
        this.transport.publish(error);
      }
      callback.reject(e);
    }
    delete this.actions[msg._txid];
  }
  let services = this.route(msg);
  this.dispatchMatchOrNoop(services.match, msg, false);
  this.dispatchMatchOrNoop(services.noop, msg, true);
  this.dispatchTap(services.tap, msg);
};

/**
 * Enrich message and return line for long stacktraces
 */
Pinball.prototype.enrichReply = function(reply, stack) {
  for (let site of stack) {
    reply._file = site.getFileName().replace(new RegExp('^' + root), '');
    if (module.id !== site.getFileName()) {
      let _func = site.getFunctionName();
      if (_func) {
        reply._func = _func;
      }
      reply._line = site.getLineNumber();
      break;
    }
  }
};

Pinball.prototype.prepareReply = function(reply, msg, noop, start) {
  reply._uuid  = uuid.v4();
  reply._coid  = msg._coid;
  reply._txid  = msg._txid;
  reply._reply = true;
  reply._noop  = noop;
  reply._time  = Date.now();
  reply._ftime = reply._time - start;
  reply._rtime = reply._time - msg._time;
  reply._left  = Math.max(0, msg._ttl - reply._ftime);
  this.addAppInfo(reply);
};

/**
 * _ftime = function time, it works even nodes have different time
 * _rtime = response time, it requires all nodes to have a sync clock
 *          it contains the transport time in one direction
 */
Pinball.prototype.dispatchMatchOrNoop = function(services, msg, noop) {
  let self = this;
  let start = Date.now();
  services.forEach(function(service) {
    service.generator.call(msg, done, act, pub).catch(function(e) {
      let reply = {};
      self.prepareReply(reply, msg, noop, start);
      reply._error = {
        stack: e.stack,
        name: e.name,
        message: e.message
      };
      self.transport.publish(reply);
    });
  });
  function done(reply) {
    reply = reply || {};
    if (!msg._pub) {
      self.prepareReply(reply, msg, noop, start);
      self.enrichReply(reply, stack());
      self.transport.publish(reply);
    }
  }
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
    service.generator.call(msg, act, pub).catch(function(e) {
      let error = {};
      error._uuid  = uuid.v4();
      error._coid  = msg._coid;
      error._txid  = msg._uuid;
      error._reply = false;
      error._pub   = true;
      error._time  = Date.now();
      error._error = {
        stack: e.stack,
        name: e.name,
        message: e.message
      };
      self.addAppInfo(error);
      self.transport.publish(error);
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
PinballRemoteError.prototype = Object.create(Error.prototype);

function PinballTimeoutError(message, line) {
  Error.call(this);
  Error.captureStackTrace(this, PinballTimeoutError);
  this.message = message;
  this.name = 'PinballTimeoutError';
  this.stack = `${ this.name }: ${ this.message }\n${ line }`;
}
PinballTimeoutError.prototype = Object.create(Error.prototype);
