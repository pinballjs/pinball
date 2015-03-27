'use strict';

let promise    = require('bluebird');
let client     = require('redis').createClient();
let stats      = require('measured').createCollection();
let prettyjson = require('prettyjson');
let co         = require('co');

client.on('message', function() {
  stats.meter('requestsPerSecond').mark();
});

let nOfTopics = 100000;
let topics = [];

for (let topic = 0; topic < nOfTopics; topic++) {
  topics.push(topic);
}

client.subscribe.apply(client, topics);

co(function *() {
  for(;;) {
    yield promise.delay(1000);
    console.log(prettyjson.render(stats.toJSON()));
  }
});

