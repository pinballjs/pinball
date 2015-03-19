'use strict';

let co            = require('co');
let elasticsearch = require('elasticsearch');
let esClient      = new elasticsearch.Client({ host: 'localhost:9200' });
let log           = require('./lib/log');
let promise       = require('bluebird');
let moment        = require('moment');
let subscribe     = require('../../lib/transport/redis/subscribe');
let request       = require('superagent-promise');
// metrics
let app           = 'elasticsearch';
let node          = process.env.NODE || 'elasticsearch01';
let semver        = process.env.SEMVER || '0.0.1';
let pinball       = require('../..')(app, node, semver);
let pub           = pinball.pub.bind(pinball);
pinball.use('redis', {}, 6379, 'localhost');
require('./lib/metrics')(pub, 10000);

let batch = [];
let seq = 0;
let max = Math.pow(2, 53);
let index = 'pinball';

let sub = subscribe('pinball', [6379, 'localhost']);
sub.on('message', function(channel, message) {
  let msg = JSON.parse(message);
  if (seq === max) { seq = 0; }
  msg['@seq'] = seq++;
  let type = createType(msg);
  batch.push({ index: { _index: getIndex(moment(new Date(msg['@timestamp'])).utc()), _type: type, _id: msg['@uuid'] }});
  batch.push(msg);
});

let body = {
  'template' : `${ index }-*`,
  'settings' : {
    'index.refresh_interval' : '5s',
    'number_of_shards': 1,
    'number_of_replicas' : 1
  },
  'mappings' : {
    '_default_' : {
      '_all' : {'enabled' : true},
      'dynamic_templates' : [ {
        'string_fields' : {
          'match' : '*',
          'match_mapping_type' : 'string',
          'mapping' : {
            'type' : 'string',
            'index' : 'not_analyzed'
          }
        }
      } ],
      'properties' : {
        '@timestamp': {
          'type': 'date'
        }
      }
    }
  }
};

co(function *() {
  yield request.post(`http://elasticsearch.service.consul:9200/_template/${ index }`)
               .accept('json')
               .send(body)
               .promise();
  for(;;) {
    try {
      yield promise.delay(1000);
      let newBatch = batch;
      batch = [];
      if (newBatch.length > 0) {
        yield esClient.bulk({ body: newBatch });
      }
    } catch(e) {
      log(e);
    }
  }
}).catch(function(err) {
  log(err);
  process.exit(1);
});

function getIndex(time) {
  let year = time.format('YYYY');
  let month = time.format('MM');
  let day = time.format('DD');
  return `pinball-${ year }.${ month }.${ day }`;
}

function createType(msg) {
  let first = msg.role || 'unkown';
  let second = 'unkown';
  if (msg.cmd) {
    second = `${ msg.cmd }_cmd`;
  } else if (msg.event) {
    second = `${ msg.event }_event`;
  } else if (msg.reply) {
    second = `${ msg.reply }_reply`;
  }
  return `${ first }_${ second }`;
}

log(`${ app } version ${ semver } started`);
