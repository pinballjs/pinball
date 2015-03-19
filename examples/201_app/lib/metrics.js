'use strict';

let co      = require('co');
let promise = require('bluebird');
let fs      = require('mz/fs');
let os      = require('os');
let cpus    = os.cpus().length;
let log     = require('./log');

module.exports = metrics;

function metrics(pub, interval) {
  if (os.platform() !== 'linux') {
    return;
  }
  co(function *() {
    let prevStats = yield getStats();
    for(;;) {
      try {
        yield promise.delay(interval);
        let msg = calculateMetrics(yield getStats());
        msg.role = 'metrics';
        msg.event = 'metrics';
        yield pub(msg);
      } catch(e) {
        log(e);
      }
    }

    function calculateMetrics(stats) {
      let u = Number((100 * (stats.utime - prevStats.utime) / (stats.total - prevStats.total)).toFixed(2));
      let s = Number((100 * (stats.stime - prevStats.stime) / (stats.total - prevStats.total)).toFixed(2));
      let mem = process.memoryUsage();
      prevStats = stats;
      return {
        user:   u,
        system: s,
        total:  Number((u + s).toFixed(2)),
        cpus: cpus,
        eventloop: true,
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        uptime: Math.round(process.uptime())
      };
    }
  }).catch(function(e) {
    log(e);
    process.exit(1);
  });
}

function *getStats() {
  let pid = process.pid;
  let files = yield {
    pstat: fs.readFile('/proc/' + pid + '/stat'),
    stat: fs.readFile('/proc/stat')
  };
  let xs = files.pstat.toString().split(' ');
  let total = files.stat.toString().split('\n')[0].split(/\s+/).slice(1)
                   .map(parseIntFn)
                   .reduce(sumReduceFn);
  let stats  = {
    utime: parseIntFn(xs[13]),
    stime: parseIntFn(xs[14]),
    total: total
  };
  return stats;
}

function parseIntFn(num) {
  return parseInt(num, 10);
}

function sumReduceFn(sum, num) {
  return sum + num;
}
