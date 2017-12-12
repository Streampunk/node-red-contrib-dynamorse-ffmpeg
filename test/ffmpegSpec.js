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

const TestUtil = require('dynamorse-test');

const encodeTestNode = () => ({
  type: 'encoder',
  z: TestUtil.testFlowId,
  name: 'encode-test',
  maxBuffer: 10,
  wsPort: TestUtil.properties.wsPort,
  x: 300.0,
  y: 100.0,
  wires: [[]]
});

const decodeTestNode = () => ({
  type: 'decoder',
  z: TestUtil.testFlowId,
  name: 'decoder-test',
  x: 500.0,
  y: 100.0,
  wires: [[]]
});

const packerTestNode = () => ({
  type: 'packer',
  z: TestUtil.testFlowId,
  name: 'packer-test',
  x: 300.0,
  y: 100.0,
  wires: [[]]
});

const converterTestNode = () => ({
  type: 'converter',
  z: TestUtil.testFlowId,
  name: 'converter-test',
  x: 300.0,
  y: 100.0,
  wires: [[]]
});

const multiviewerTestNode = () => ({
  type: 'multiviewer',
  z: TestUtil.testFlowId,
  name: 'multiviewer-test',
  x: 300.0,
  y: 100.0,
  wires: [[]]
});

const multiviewerConfigNode = () => ({
  type: 'multiview setup',
  z: TestUtil.testFlowId,
  name: 'multiview-setup-test'
});

const funnel1NodeId = '24fde3d7.b7544c';
const funnel2NodeId = 'ba156ff1.45ea9';
const funnel3NodeId = '6e6a8581.91957c';
const funnel4NodeId = '333f72f.fccc08e';
const encoderNodeId = '7c968c40.836974';
const decoderNodeId = '634c3672.78be18';
const packerNodeId = '145f639d.4b63ac';
const converter1NodeId = '5c14afb6.b1cf3';
const converter2NodeId = 'b1b36be1.4e4c98';
const converter3NodeId = 'b5383380.4ac7d';
const converter4NodeId = '70208d26.8fdf74';
const multiviewerNodeId = '107c721c.8c951e';
const multiviewerConfigNodeId = '542ffc64.d42aa4';
const spoutNodeId = 'f2186999.7e5f78';

TestUtil.nodeRedTest('A src->encoder->decoder->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  encodeFmt: 'h264',
  encodeBitrate: 5000000,
  encodeGopFrames: 5,
  encoderMaxBuffer: 10,
  decoderMaxBuffer: 10,
  spoutTimeout: 0
}, (params) => {
  const testFlow = TestUtil.testNodes.baseTestFlow();
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel1NodeId,
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    wires: [ [ encoderNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(encodeTestNode(), {
    id: encoderNodeId,
    dstFormat: params.encodeFmt,
    bitrate: params.encodeBitrate,
    gopFrames: params.encodeGopFrames,
    maxBuffer: params.encoderMaxBuffer,
    wires: [ [ decoderNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(decodeTestNode(), {
    id: decoderNodeId,
    maxBuffer: params.decoderMaxBuffer,
    wires: [ [ spoutNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.spoutTestNode(), {
    id: spoutNodeId,
    timeout: params.spoutTimeout,
    x: 700.0
  }));
  return testFlow;
}, (t, params, msgObj, onEnd) => {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, 'received end after expected number of pushes');
    onEnd();
  }
});

TestUtil.nodeRedTest('A src->packer->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  packerFmt: 'pgroup',
  packerMaxBuffer: 10,
  spoutTimeout: 0
}, (params) => {
  const testFlow = TestUtil.testNodes.baseTestFlow();
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel1NodeId,
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    wires: [ [ packerNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(packerTestNode(), {
    id: packerNodeId,
    dstFormat: params.packerFmt,
    maxBuffer: params.packerMaxBuffer,
    wires: [ [ spoutNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.spoutTestNode(), {
    id: spoutNodeId,
    timeout: params.spoutTimeout,
    x: 500.0
  }));
  return testFlow;
}, (t, params, msgObj, onEnd) => {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, 'received end after expected number of pushes');
    onEnd();
  }
});

TestUtil.nodeRedTest('A src->converter->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  converterWidth: 1280,
  converterHeight: 720,
  converterFmt: 'YUV422P10',
  converterMaxBuffer: 10,
  spoutTimeout: 0
}, (params) => {
  const testFlow = TestUtil.testNodes.baseTestFlow();
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel1NodeId,
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    wires: [ [ converter1NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(converterTestNode(), {
    id: converter1NodeId,
    scaleX: 1.0,
    scaleY: 1.0,
    dstWidth: params.converterWidth,
    dstHeight: params.converterHeight,
    dstFormat: params.converterFmt,
    maxBuffer: params.converterMaxBuffer,
    wires: [ [ spoutNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.spoutTestNode(), {
    id: spoutNodeId,
    timeout: params.spoutTimeout,
    x: 500.0
  }));
  return testFlow;
}, (t, params, msgObj, onEnd) => {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, 'received end after expected number of pushes');
    onEnd();
  }
});

TestUtil.nodeRedTest('A (src->converter)x4->mutiviewer->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  converterMaxBuffer: 10,
  multiviewerMaxBuffer: 10,
  multiviewerTiles: 4,
  multiviewerWidth: 1280,
  multiviewerHeight: 720,
  multiviewerFormat: '420P',
  spoutTimeout: 0
}, (params) => {
  const testFlow = TestUtil.testNodes.baseTestFlow();
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel1NodeId,
    name: 'funnel1',
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    y: 100.0,
    wires: [ [ converter1NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel2NodeId,
    name: 'funnel2',
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    y: 200.0,
    wires: [ [ converter2NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel3NodeId,
    name: 'funnel3',
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    y: 300.0,
    wires: [ [ converter3NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.funnelGrainNode(), {
    id: funnel4NodeId,
    name: 'funnel4',
    numPushes: params.numPushes,
    maxBuffer: params.funnelMaxBuffer,
    y: 400.0,
    wires: [ [ converter4NodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(converterTestNode(), {
    id: converter1NodeId,
    name: 'converter1',
    multiviewSetup: multiviewerConfigNodeId,
    scaleX: 1.0,
    scaleY: 1.0,
    maxBuffer: params.converterMaxBuffer,
    y: 100.0,
    wires: [ [ multiviewerNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(converterTestNode(), {
    id: converter2NodeId,
    name: 'converter2',
    multiviewSetup: multiviewerConfigNodeId,
    scaleX: 1.0,
    scaleY: 1.0,
    maxBuffer: params.converterMaxBuffer,
    y: 200.0,
    wires: [ [ multiviewerNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(converterTestNode(), {
    id: converter3NodeId,
    name: 'converter3',
    multiviewSetup: multiviewerConfigNodeId,
    scaleX: 1.0,
    scaleY: 1.0,
    maxBuffer: params.converterMaxBuffer,
    y: 300.0,
    wires: [ [ multiviewerNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(converterTestNode(), {
    id: converter4NodeId,
    name: 'converter4',
    multiviewSetup: multiviewerConfigNodeId,
    scaleX: 1.0,
    scaleY: 1.0,
    maxBuffer: params.converterMaxBuffer,
    y: 400.0,
    wires: [ [ multiviewerNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(multiviewerTestNode(), {
    id: multiviewerNodeId,
    dstWidth: params.multiviewerWidth,
    dstHeight: params.multiviewerHeight,
    dstFormat: params.multiviewerFormat,
    multiviewSetup: multiviewerConfigNodeId,
    maxBuffer: params.multiviewerMaxBuffer,
    x: 500.0,
    wires: [ [ spoutNodeId ] ]
  }));
  testFlow.nodes.push(Object.assign(multiviewerConfigNode(), {
    id: multiviewerConfigNodeId,
    tiles: params.multiviewerTiles
  }));
  testFlow.nodes.push(Object.assign(TestUtil.testNodes.spoutTestNode(), {
    id: spoutNodeId,
    timeout: params.spoutTimeout,
    x: 700.0
  }));
  return testFlow;
}, (t, params, msgObj, onEnd) => {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, 'received end after expected number of pushes');
    onEnd();
  }
});
