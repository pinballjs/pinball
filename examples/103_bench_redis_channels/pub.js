'use strict';

let promise    = require('bluebird');
let client     = require('redis').createClient();
let stats      = require('measured').createCollection();
let prettyjson = require('prettyjson');
let co         = require('co');

co(function *() {
  for(;;) {
    yield promise.delay(1000);
    console.log(prettyjson.render(stats.toJSON()));
  }
});

let topic = 0;
let nOfTopics = 100000;

function publish() {
  stats.meter('requestsPerSecond').mark();
  client.publish(topic++, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  if (topic === nOfTopics) {
    topic = 0;
  }
  setImmediate(publish);
}

publish();
