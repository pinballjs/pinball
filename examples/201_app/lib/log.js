'use strict';

let log = require('debug')('app:log');

module.exports = function(e) {
  if (e.stack) {
    log(e.stack);
  } else {
    log(e);
  }
};
