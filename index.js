'use strict';

function foo() {
  throw new InputError('wat!');
}

foo();

function InputError(message) {
  Error.call(this);
  Error.captureStackTrace(this, InputError);
  this.message = message;
  this.name = 'InputError';
}
InputError.prototype = Object.create(Error.prototype);
