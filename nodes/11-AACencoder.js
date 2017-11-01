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
const ValveCommon = require('./valveCommon.js').ValveCommon;
const codecadon = require('codecadon');

module.exports = function (RED) {
  function AACEncoder (config) {
    RED.nodes.createNode(this, config);
    ValveCommon.call(this, RED, config);

    var encoder = new codecadon.Encoder(() => this.log('AAC Encoder exiting'));
    encoder.on('error', err => this.error('AAC Encoder error: ' + err));

    let packetNumBytes = 8192;
    let lastBuf = Buffer.alloc(0);

    this.getProcessSources = cable => {
      const sel = [{ type: 'audio', index: 0 }];
      if (!(Array.isArray(cable[0][sel[0].type]) && cable[0][sel[0].type].length > 0)) {
        throw new Error(`Logical cable does not contain flow ${sel[0].type}[${sel[0].index}]`);
      }
      return sel;
    };

    this.makeDstTags = srcTags => {
      const dstTags = JSON.parse(JSON.stringify(srcTags));
      dstTags.encodingName = 'AAC';
      return dstTags;
    };

    this.setInfo = (srcTags, dstTags, duration, logLevel) => {
      const numChannels = srcTags.channels;
      const bitsPerSample = +srcTags.encodingName.substring(1);
      packetNumBytes = 1024 * numChannels * (((bitsPerSample+7) / 8) >>> 0);

      const encodeTags = {};
      encodeTags.bitrate = config.bitrate;

      return encoder.setInfo(srcTags, dstTags, duration, encodeTags, logLevel);
    };

    this.processGrain = (x, dstBufLen, next, cb) => {
      let curStart = 0;
      let numSrcPkts = 0;
      let numDstPkts = 0;

      while (curStart + packetNumBytes - lastBuf.length < x.buffers[0].length) {
        const packet = Buffer.concat([lastBuf, x.buffers[0].slice(curStart, curStart + packetNumBytes - lastBuf.length)], packetNumBytes);
        curStart += packetNumBytes - lastBuf.length;
        if (lastBuf.length)
          lastBuf = Buffer.alloc(0);
        numSrcPkts++;

        const dstBuf = Buffer.alloc(dstBufLen);
        encoder.encode([packet], dstBuf, (err, result) => {
          numDstPkts++;
          cb(err, result);
          if (numDstPkts === numSrcPkts)
            next();
        });
      }
      lastBuf = Buffer.concat([lastBuf, x.buffers[0].slice(curStart, x.buffers[0].length)],
        lastBuf.length + x.buffers[0].length - curStart);
      if (!numSrcPkts) // this grain didn't fill the encode packet
        next();
    };

    this.quit = cb => {
      encoder.quit(() => cb());
    };

    this.closeValve = done => {
      this.close(done);
    };
  }
  util.inherits(AACEncoder, ValveCommon);
  RED.nodes.registerType('AAC encoder', AACEncoder);
};
