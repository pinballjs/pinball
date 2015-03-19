'use strict';

let promise = require('bluebird');
let request = require('superagent-promise');
let co      = require('co');
let log     = require('../log');

module.exports = function(act, pub) {
  co(function *() {
    yield promise.delay(100);
    for(;;) {
      try {
        let res = yield queryGithub();
        yield pub({ role:'github', event:'status', messages:res.body });
      } catch(e) {
        log(e);
      } finally {
        yield promise.delay(1000);
      }
    }
  });
};

function queryGithub() {
  let url='https://status.github.com/api/messages.json';
  return request.get(url).promise();
}
