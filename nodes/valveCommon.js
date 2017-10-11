/* Copyright 2017 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const util = require('util');
const redioactive = require('node-red-contrib-dynamorse-core').Redioactive;
const Grain = require('node-red-contrib-dynamorse-core').Grain;

function ValveCommon (RED, config) {
  redioactive.Valve.call(this, config);

  const logLevel = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].indexOf(RED.settings.logging.console.level);
  let srcTags = null;
  let flowID = null;
  let sourceID = null;
  let dstBufLen = 0;
  
  this.doProcess = (x, dstBufLen, push, next) => {
    this.processGrain(x, dstBufLen, next, (err, result) => {
      if (err) {
        push(err);
      } else if (result) {
        push(null, new Grain(result, x.ptpSync, x.ptpOrigin,
          x.timecode, flowID, sourceID, x.duration));
      }
    });
  };

  this.consume((err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (redioactive.isEnd(x)) {
      this.quit(() => {
        push(null, x);
      });
    } else if (Grain.isGrain(x)) {
      const nextJob = (srcTags) ?
        Promise.resolve(x) :
        this.findCable(x).then(cable => {
          srcTags = this.findSrcTags(cable);
          const dstTags = this.makeDstTags(srcTags);
          const formattedDstTags = JSON.stringify(dstTags, null, 2);
          RED.comms.publish('debug', {
            format: `${config.type} output flow tags:`,
            msg: formattedDstTags
          }, true);

          this.makeCable({ video : [{ tags : dstTags }], backPressure : 'video[0]' });
          flowID = this.flowID();
          sourceID = this.sourceID();

          dstBufLen = this.setInfo(srcTags, dstTags, x.duration, logLevel);
        });

      nextJob.then(() => {
        this.doProcess (x, dstBufLen, push, next);
      }).catch(err => {
        push(err);
        next();
      });
    } else {
      push(null, x);
      next();
    }
  });

  this.on('close', this.closeValve);
}
util.inherits(ValveCommon, redioactive.Valve);

module.exports = {
  ValveCommon: ValveCommon
};
