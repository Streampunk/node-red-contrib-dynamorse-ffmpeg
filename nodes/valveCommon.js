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
var uuid = require('uuid');

function ValveCommon (RED, config) {
  redioactive.Valve.call(this, config);

  const logLevel = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].indexOf(RED.settings.logging.console.level);
  let cableChecked = false;
  let setupError = null;
  let srcIDs = [];
  let flowID = null;
  let sourceID = null;
  let passthruFlowIDs = [];
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
      next(redioactive.noTiming);
    } else if (redioactive.isEnd(x)) {
      this.quit(() => {
        push(null, x);
      });
    } else if (Grain.isGrain(x)) {
      const nextJob = (cableChecked) ?
        Promise.resolve(x) :
        this.findCable(x)
          .then(cable => {
            cableChecked = true;
            const processSel = this.getProcessSources(cable);
            const processType = processSel[0].type;
            const srcTags = cable[0][processType][processSel[0].index].tags;
            processSel.forEach(s =>
              srcIDs.push({ flowID: cable[0][s.type][s.index].flowID, sourceID:cable[0][s.type][s.index].sourceID }));

            const dstTags = this.makeDstTags(srcTags);
            dstBufLen = this.setInfo(srcTags, dstTags, x.duration, logLevel);

            let outCableSpec = {};
            const cableTypes = Object.keys(cable[0]);
            cableTypes.forEach(t => {
              if (processType === t)
                outCableSpec[t] = [{ tags: dstTags }];
              else if (cable[0][t] && Array.isArray(cable[0][t])) {
                outCableSpec[t] = cable[0][t];
                cable[0][t].forEach(f => passthruFlowIDs.push({ flowID: f.flowID, sourceID: f.sourceID }));
              }
            });          

            outCableSpec.backPressure = cable[0].backPressure;
            const outCable = this.makeCable(outCableSpec);
            flowID = outCable[processType][0].flowID;
            sourceID = outCable[processType][0].sourceID;

            const formattedCable = JSON.stringify(outCable, null, 2);
            RED.comms.publish('debug', {
              format: `${config.type} output cable:`,
              msg: formattedCable
            }, true);
            return x;
          });

      nextJob.then(x => {
        if (setupError) {
          push(setupError);
          return next();
        }
        else {
          const grainFlowID = uuid.unparse(x.flow_id);
          const grainSourceID = uuid.unparse(x.source_id);
          if (srcIDs.find(id => (grainFlowID === id.flowID) && (grainSourceID === id.sourceID)))
            return this.doProcess (x, dstBufLen, push, next);
          else if (passthruFlowIDs.find(id => (grainFlowID === id.flowID) && (grainSourceID === id.sourceID))) {
            push(null, x);
            return next(redioactive.noTiming);
          } 
          else {
            console.log(`Dropping grain with flowID ${grainFlowID}`);
            return next(redioactive.noTiming);
          }
        }
      }).catch(err => {
        setupError = err;
        push(err);
        next(redioactive.noTiming);
      });
    } else {
      push(null, x);
      next(redioactive.noTiming);
    }
  });

  this.on('close', this.closeValve);
}
util.inherits(ValveCommon, redioactive.Valve);

module.exports = {
  ValveCommon: ValveCommon
};
