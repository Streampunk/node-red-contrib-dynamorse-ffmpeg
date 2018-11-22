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

const uuid = require('uuid');
const util = require('util');
const redioactive = require('node-red-contrib-dynamorse-core').Redioactive;
const Grain = require('node-red-contrib-dynamorse-core').Grain;
const codecadon = require('codecadon');

function Queue() {
  this.stack = [];
  this.entry = i => this.stack[this.length() - i - 1]; // flip so that the stack appears to be a fifo not a lifo!!
  this.front = () => this.entry(0);
  this.dequeue = () => this.stack.pop();
  this.enqueue = item => this.stack.unshift(item);
  this.length = () => this.stack.length;
}

function srcSlot(grain, slotNum) {
  this.grain = grain;
  this.slotNum = slotNum;
}

function dstTile(dstBufBytes, numSlots) {
  this.dstBuf = Buffer.alloc(dstBufBytes);
  this.numEmptySlots = numSlots;
}

dstTile.prototype.setSlotDone = function() { 
  if (this.numEmptySlots > 0)
    --this.numEmptySlots;
};

dstTile.prototype.forceAllDone = function() {
  this.numEmptySlots = 0;
};

dstTile.prototype.isDone = function() {
  return 0 === this.numEmptySlots;
};

function multiviewSlots(numSlots, maxQueue, dstBufBytes) {
  this.numSlots = numSlots;
  this.maxQueue = maxQueue;
  this.dstBufBytes = dstBufBytes;

  this.dstTiles = new Queue();
  this.slotQueue = [];
  for (let i=0; i<this.numSlots; ++i)
    this.slotQueue[i] = new Queue();
}

multiviewSlots.prototype.addDstTile = function(preWipe) {
  const newDstTile = new dstTile(this.dstBufBytes, this.numSlots);
  preWipe(newDstTile.dstBuf); // wipe is queued but will be completed before any other operation
  this.dstTiles.enqueue(newDstTile);
  return newDstTile;
};

multiviewSlots.prototype.addSrcSlot = function(x, slotNum, preWipe) {
  const curQueue = this.slotQueue[slotNum];
  const curSrcSlot = new srcSlot(x, slotNum);
  
  let curDstTile = null;
  const curIndex = curQueue.length();
  if (this.dstTiles.length() === curIndex)
    curDstTile = this.addDstTile(preWipe);
  else
    curDstTile = this.dstTiles.entry(curIndex);

  if (0 === curDstTile.numEmptySlots) {
    console.log('Discarding srcSlot tile ' + slotNum + ' - dstTile marked as full!!');
    return;
  }
  curQueue.enqueue(curSrcSlot);
  
  return curDstTile;
};

multiviewSlots.prototype.setSlotDone = function(dstTile) {
  dstTile.setSlotDone();

  let doneDstTile = null;
  const frontDstTile = this.dstTiles.front();
  if (frontDstTile) {
    if ((this.dstTiles.length() > this.maxQueue) && !frontDstTile.isDone()) {
      console.log('Forcing flush of partially complete multiviewer tile');
      frontDstTile.forceAllDone();
    }

    if (frontDstTile.isDone()) {
      doneDstTile = this.dstTiles.dequeue();
      for (let i=0; i<this.numSlots; ++i) {
        this.slotQueue[i].dequeue();
      }
    }
  }

  return doneDstTile;
};

module.exports = function (RED) {
  function Multiviewer (config) {
    RED.nodes.createNode(this, config);
    redioactive.Valve.call(this, config);

    const logLevel = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].indexOf(RED.settings.logging.console.level);
    const maxQueue = 2;
    let cableChecked = false;
    let setupError = null;
    let srcCable = null;
    let srcIDs = [];
    let flowID = null;
    let sourceID = null;
    let multiview = null;
    let dstOrgs = [];
    let dstBufLen = 0;
    let numEnds = 0;

    const multiviewSetup = RED.nodes.getNode(config.multiviewSetup);
    if (!multiviewSetup)
      return node.log('Multiviewer setup config not found!!');

    const numTiles = +multiviewSetup.tiles;
    const numHTiles = numTiles / 2;
    const numVTiles = numHTiles;
    multiviewSetup.tileWidth = +config.dstWidth / numHTiles;
    multiviewSetup.tileHeight = +config.dstHeight / numVTiles;
    multiviewSetup.tileFormat = config.dstFormat;

    let i=0;
    for (let v=0; v<numVTiles; ++v)
      for (let h=0; h<numHTiles; ++h)
        dstOrgs[i++] = [(+config.dstWidth * h) / numHTiles, (+config.dstHeight * v) / numVTiles];

    const stamper = new codecadon.Stamper(() => this.log('stamper exiting'));
    stamper.on('error', err => this.error('Stamper error: ' + err));

    const node = this;

    function checkSrcFlowIds(flowId) {
      for (let i=0; i<srcCable.length; ++i) {
        if (flowId === srcCable[i].video[0].flowID) 
          return i;
      }
    }

    function preWipe(dstBuf) {
      const paramTags = {
        wipeRect:[0, 0, +config.dstWidth, +config.dstHeight],
        wipeCol:[0.0, 0.0, 0.0]
      };
      stamper.wipe(dstBuf, paramTags, (err) => {
        if (err)
          node.error(err);
      });
    }

    function processGrain(x, slotNum, push, next) {
      const dstTile = multiview.addSrcSlot.call(multiview, x, slotNum, preWipe);
      if (!dstTile) { next(); return; }

      const paramTags = { dstOrg:dstOrgs[slotNum] };
      stamper.copy(x.buffers, dstTile.dstBuf, paramTags, (err) => {
        if (err) {
          push(err);
        } else {
          const doneDstTile = multiview.setSlotDone(dstTile);
          if (doneDstTile) {
            push(null, new Grain(doneDstTile.dstBuf, x.ptpSync, x.ptpOrigin,
              x.timecode, flowID, sourceID, x.duration));
          }
        }
        next();
      });
    }

    this.consume((err, x, push, next) => {
      if (err) {
        push(err);
        next(redioactive.noTiming);
      } else if (redioactive.isEnd(x)) {
        if (srcCable && (srcCable.length === ++numEnds)) {
          stamper.quit(() => {
            push(null, x);
          });
        }
      } else if (Grain.isGrain(x)) {
        const nextJob = (cableChecked) ?
          Promise.resolve(x) :
          this.findCable(x).then(cable => {
            if (cableChecked)
              return x;

            cableChecked = true;
            srcCable = cable.filter((c, i) => i < numTiles);
            if (srcCable.length < numTiles)
              return Promise.reject(`Multiviewer configured for ${numTiles} input wires, only ${srcCable.length} found`);

            for (let i=0; i<numTiles; ++i)
              if (!(Array.isArray(srcCable[i].video) && srcCable[1].video.length > 0))
                return Promise.reject(`Input wire ${i} does not contain video`);

            const srcTags = cable[0].video[0].tags;
            srcCable.forEach((s, i) =>
              srcIDs.push({ flowID: srcCable[i]['video'][0].flowID, sourceID: srcCable[i]['video'][0].sourceID }));
                
            const dstTags = JSON.parse(JSON.stringify(srcTags));
            dstTags.width = config.dstWidth;
            dstTags.height = config.dstHeight;
            dstTags.packing = config.dstFormat;
            if ('420P' === config.dstFormat) {
              dstTags.depth = 8;
              dstTags.sampling = 'YCbCr-4:2:0';
            }
            else {
              dstTags.depth = 10;
              dstTags.sampling = 'YCbCr-4:2:2';
            }

            const formattedDstTags = JSON.stringify(dstTags, null, 2);
            RED.comms.publish('debug', {
              format: 'Multiviewer output flow tags:',
              msg: formattedDstTags
            }, true);

            this.makeCable({ video : [{ tags : dstTags }], backPressure : 'video[0]' });
            flowID = this.flowID();
            sourceID = this.sourceID();
              
            dstBufLen = stamper.setInfo(srcTags, dstTags, logLevel);
            multiview = new multiviewSlots(numTiles, maxQueue, dstBufLen);
            return x;
          });

        nextJob.then(x => {
          if (setupError) {
            push(setupError);
            return next(redioactive.noTiming);
          } else {
            const grainFlowID = uuid.unparse(x.flow_id);
            const grainSourceID = uuid.unparse(x.source_id);
            if (srcIDs.find(id => (grainFlowID === id.flowID) && (grainSourceID === id.sourceID))) {
              const slotNum = checkSrcFlowIds(grainFlowID);
              return processGrain(x, slotNum, push, next);
            } else {
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
    this.on('close', done => done());
  }
  util.inherits(Multiviewer, redioactive.Valve);
  RED.nodes.registerType('multiviewer', Multiviewer);
};
