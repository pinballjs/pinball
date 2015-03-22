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

function publishRejectHandler(e) {
  console.log(e.stack);
}

function Pinball(app, node, semver) {
  this.app    = app || 'app';
  this.node   = node || 'default';
  this.semver = semver|| '0.0.1';
  this.runid = Math.floor(Math.random() * Math.pow(2,53));
  this.prefix = '@';
  this.services = [];
  this.actions = {};
}

Pinball.prototype.get = function(msg, field) {
  return msg[`${ this.prefix }${ field }`];
};

Pinball.prototype.set = function(msg, field, value) {
  msg[`${ this.prefix }${ field }`] = value;
};

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
  let _txid = this.get(msg, 'txid');
  this.set(msg, 'arity', arity);
  this.set(msg, 'ttl', ttl);
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
    if (self.get(msg, 'txid') === self.get(msg, 'coid')) {
      let error = {};
      self.prepareError(error, msg, e);
      self.transport.publish(error).catch(publishRejectHandler);
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
  this.set(msg, 'uuid', _txid);
  this.set(msg, 'txid', _txid);
  this.set(msg, 'coid', this.get(msg, 'coid') || _txid);
  this.set(msg, 'reply', false);
  this.set(msg, 'timestamp', Date.now());
  for (let site of stack) {
    let _file = site.getFileName();
    this.set(msg, 'file', _file.replace(new RegExp('^' + root), ''));
    if (module.id !== site.getFileName()) {
      let _func = site.getFunctionName();
      if (_func) {
        this.set(msg, 'func', _func);
      }
      this.set(msg, 'line', site.getLineNumber());
      line = `    at ${ _func || 'anonymous' } (${ _file }:${ site.getLineNumber() }`;
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
  this.set(msg, 'app', this.app);
  this.set(msg, 'node', this.node);
  this.set(msg, 'runid', this.runid);
  this.set(msg, 'semver', this.semver);
};

/**
 * Send a message, but don't wait for a reply
 */
Pinball.prototype.pub = function(msg, arity) {
  arity = arity || 2;
  debug('pub %o with arity %o', msg, arity);
  this.enrichMessage(msg, stack());
  this.set(msg, 'arity', arity);
  this.set(msg, 'pub', true);
  return this.transport.publish(msg);
};

Pinball.prototype.close = function() {
  this.transport.close();
};

Pinball.prototype.prepareError = function(error, msg, e) {
  this.set(error, 'uuid', uuid.v4());
  this.set(error, 'coid', this.get(msg, 'coid'));
  this.set(error, 'txid', this.get(error, 'uuid'));
  this.set(error, 'reply', false);
  this.set(error, 'pub', true);
  this.set(error, 'timestamp', Date.now());
  this.set(error, 'error', {
    stack: e.stack,
    name: e.name,
    message: e.message
  });
  this.addAppInfo(error);
};

Pinball.prototype.dispatch = function(msg) {
  let callback = this.actions[this.get(msg, 'txid')];
  debug('dispatch %o', msg);
  if (callback && this.get(msg, 'reply') && !this.get(msg, 'noop')) {
    if (!this.get(msg, 'error')) {
      debug('resolve %o', msg);
      callback.resolve(msg);
    } else {
      debug('reject %o', msg);
      let e = new PinballRemoteError(msg, callback.line, this.get.bind(this));
      if (this.get(msg, 'txid') === this.get(msg, 'coid')) {
        let error = {};
        this.prepareError(error, msg, e);
        this.transport.publish(error).catch(publishRejectHandler);
      }
      callback.reject(e);
    }
    delete this.actions[this.get(msg, 'txid')];
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
    this.set(reply, 'file', site.getFileName().replace(new RegExp('^' + root), ''));
    if (module.id !== site.getFileName()) {
      let _func = site.getFunctionName();
      if (_func) {
        this.set(reply, 'func', _func);
      }
      this.set(reply, 'line', site.getLineNumber());
      break;
    }
  }
};

Pinball.prototype.prepareReply = function(reply, msg, noop, start) {
  this.set(reply, 'uuid', uuid.v4());
  this.set(reply, 'coid', this.get(msg, 'coid'));
  this.set(reply, 'txid', this.get(msg, 'txid'));
  this.set(reply, 'reply', true);
  this.set(reply, 'noop', noop);
  this.set(reply, 'timestamp', Date.now());
  this.set(reply, 'ftime', this.get(reply, 'timestamp') - start);
  this.set(reply, 'rtime', this.get(reply, 'timestamp') - this.get(msg, 'timestamp'));
  this.set(reply, 'left', Math.max(0, this.get(msg, 'ttl') - this.get(reply, 'ftime')));
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
      self.set(reply, 'error', {
        stack: e.stack,
        name: e.name,
        message: e.message
      });
      self.transport.publish(reply).catch(publishRejectHandler);
    });
  });
  function done(reply) {
    reply = reply || {};
    if (!self.get(msg, 'pub')) {
      self.prepareReply(reply, msg, noop, start);
      self.enrichReply(reply, stack());
      self.transport.publish(reply).catch(publishRejectHandler);
    }
  }
  function act() {
    let args = Array.prototype.slice.call(arguments, 0);
    self.set(args[0], 'coid', self.get(msg, 'coid'));
    return self.act.apply(self, args);
  }
  function pub() {
    let args = Array.prototype.slice.call(arguments, 0);
    self.set(args[0], 'coid', self.get(msg, 'coid'));
    return self.pub.apply(self, args);
  }
};

Pinball.prototype.dispatchTap = function(services, msg) {
  let self = this;
  services.forEach(function(service) {
    service.generator.call(msg, act, pub).catch(function(e) {
      let error = {};
      self.set(error, 'uuid', uuid.v4());
      self.set(error, 'coid', self.get(msg, 'coid'));
      self.set(error, 'txid', self.get(msg, 'uuid'));
      self.set(error, 'reply', false);
      self.set(error, 'pub', true);
      self.set(error, 'timestamp', Date.now());
      self.set(error, 'error', {
        stack: e.stack,
        name: e.name,
        message: e.message
      });
      self.addAppInfo(error);
      self.transport.publish(error).catch(publishRejectHandler);
    });
  });
  function act() {
    let args = Array.prototype.slice.call(arguments, 0);
    self.set(args[0], 'coid', self.get(msg, 'coid'));
    return self.act.apply(self, args);
  }
  function pub() {
    let args = Array.prototype.slice.call(arguments, 0);
    self.set(args[0], 'coid', self.get(msg, 'coid'));
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
  let self = this;
  let res = { match: [], tap: [], noop: [] };
  this.services.forEach(function(service) {
    if (_.matches(service.pattern)(msg)) {
      if (self.get(msg, 'arity') === service.arity && !service.tap) {
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
  let self = this;
  let cleanReply= {};
  _.forOwn(reply, function(value, key) {
    if (key.charAt(0) !== self.prefix) {
      cleanReply[key] = value;
    }
  });
  return cleanReply;
};

function PinballRemoteError(msg, line, get) {
  let error = get(msg, 'error');
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
