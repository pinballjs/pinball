'use strict';

let pinball = require('../..')();

pinball.use('redis')
       .add({ role:'salestax', cmd:'calculate' }, calculate);

function *calculate(done) {
  done({ role:'salestax', reply:'calculate', total: this.net * 1.2 });
}
