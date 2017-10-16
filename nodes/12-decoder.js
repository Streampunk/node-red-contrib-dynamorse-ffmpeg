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
  function Decoder (config) {
    RED.nodes.createNode(this, config);
    ValveCommon.call(this, RED, config);

    const decoder = new codecadon.Decoder(() => this.log('decoder exiting'));
    decoder.on('error', err => this.error('decoder error: ' + err));

    this.findSrcTags = cable => {
      if (!Array.isArray(cable[0].video) && cable[0].video.length < 1) {
        return Promise.reject('Logical cable does not contain video');
      }
      return cable[0].video[0].tags;
    };

    this.makeDstTags = srcTags => {
      const dstTags = JSON.parse(JSON.stringify(srcTags));
      dstTags.packing = '420P';
      dstTags.encodingName = 'raw';
      dstTags.sampling = 'YCbCr-4:2:0';
      return dstTags;
    };

    this.setInfo = (srcTags, dstTags, duration, logLevel) => {
      return decoder.setInfo(srcTags, dstTags, logLevel);
    };

    this.processGrain = (x, dstBufLen, next, cb) => {
      const dstBuf = Buffer.alloc(dstBufLen);
      decoder.decode(x.buffers, dstBuf, (err, result) => {
        cb(err, result);
        next();
      });
    };

    this.quit = cb => {
      decoder.quit(() => cb());
    };

    this.closeValve = done => {
      this.close(done);
    };
  }

  util.inherits(Decoder, ValveCommon);
  RED.nodes.registerType('decoder', Decoder);
};
