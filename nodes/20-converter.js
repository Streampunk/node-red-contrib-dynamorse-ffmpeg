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
  function Converter (config) {
    RED.nodes.createNode(this, config);
    ValveCommon.call(this, RED, config);

    this.multiviewSetup = RED.nodes.getNode(config.multiviewSetup);
    if (this.multiviewSetup) {
      setImmediate(() => {
        this.log ('Multiview setup - tiles: ' + this.multiviewSetup.tiles + ', size: ' + this.multiviewSetup.tileWidth + 'x' + this.multiviewSetup.tileHeight);
        config.dstWidth = +this.multiviewSetup.tileWidth;
        config.dstHeight = +this.multiviewSetup.tileHeight;
        config.dstFormat = this.multiviewSetup.tileFormat;
        this.log ('Converter size: ' + config.dstWidth + 'x' + config.dstHeight + ', format: ' + config.dstFormat);
      });
    }

    const converter = new codecadon.ScaleConverter(() => this.log('converter exiting'));
    converter.on('error', err => this.error('converter error: ' + err));

    this.getProcessSources = cable => {
      const sel = [{ type: 'video', index: 0 }];
      if (!(Array.isArray(cable[0][sel[0].type]) && cable[0][sel[0].type].length > 0)) {
        throw new Error(`Logical cable does not contain flow ${sel[0].type}[${sel[0].index}]`);
      }
      return sel;
    };

    this.makeDstTags = srcTags => {
      const dstTags = JSON.parse(JSON.stringify(srcTags));
      dstTags.width = +config.dstWidth;
      dstTags.height = +config.dstHeight;
      dstTags.packing = config.dstFormat;
      if ('420P' === config.dstFormat) {
        dstTags.depth = 8;
        dstTags.sampling = 'YCbCr-4:2:0';
      }
      else {
        dstTags.depth = 10;
        dstTags.sampling = 'YCbCr-4:2:2';
      }

      let srcHasAlpha = !(null == srcTags.hasAlpha);
      if (srcHasAlpha) {
        if (Array.isArray(srcTags.hasAlpha))
          srcHasAlpha = ('true' === srcTags.hasAlpha[0]) || ('1' === srcTags.hasAlpha[0]);
        else
          srcHasAlpha = srcTags.hasAlpha;
      }
      dstTags.hasAlpha = srcHasAlpha && config.dstAlpha;
      return dstTags;
    };

    this.setInfo = (srcTags, dstTags, duration, logLevel) => {
      const scaleTags = {};
      scaleTags.scale = [ +config.scaleX, +config.scaleY ];
      scaleTags.dstOffset = [ 0, 0 ];

      return converter.setInfo(srcTags, dstTags, scaleTags, logLevel);
    };

    this.processGrain = (x, dstBufLen, next, cb) => {
      const dstBuf = Buffer.alloc(dstBufLen);
      converter.scaleConvert(x.buffers, dstBuf, (err, result) => {
        cb(err, result);
        next();
      });
    };

    this.quit = cb => {
      converter.quit(() => cb());
    };

    this.closeValve = done => {
      this.close(done);
    };

  }

  util.inherits(Converter, ValveCommon);
  RED.nodes.registerType('converter', Converter);
};
