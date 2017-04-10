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

var TestUtil = require('dynamorse-test').TestUtil;

var encodeTestNode = JSON.stringify({
  "type": "encoder",
  "z": TestUtil.testFlowId,
  "name": "encode-test",
  "maxBuffer": 10,
  "wsPort": TestUtil.properties.wsPort,
  "x": 300.0,
  "y": 100.0,
  "wires": [[]]
});

var decodeTestNode = JSON.stringify({
  "type": "decoder",
  "z": TestUtil.testFlowId,
  "name": "decoder-test",
  "x": 500.0,
  "y": 100.0,
  "wires": [[]]
});

var packerTestNode = JSON.stringify({
  "type": "packer",
  "z": TestUtil.testFlowId,
  "name": "packer-test",
  "x": 300.0,
  "y": 100.0,
  "wires": [[]]
});

var converterTestNode = JSON.stringify({
  "type": "converter",
  "z": TestUtil.testFlowId,
  "name": "converter-test",
  "x": 300.0,
  "y": 100.0,
  "wires": [[]]
});

var multiviewerTestNode = JSON.stringify({
  "type": "multiviewer",
  "z": TestUtil.testFlowId,
  "name": "multiviewer-test",
  "x": 300.0,
  "y": 100.0,
  "wires": [[]]
});

var multiviewerConfigNode = JSON.stringify({
  "type": "multiview setup",
  "z": TestUtil.testFlowId,
  "name": "multiview-setup-test"
});

var funnel1NodeId = "24fde3d7.b7544c";
var funnel2NodeId = "ba156ff1.45ea9";
var funnel3NodeId = "6e6a8581.91957c";
var funnel4NodeId = "333f72f.fccc08e";
var encoderNodeId = "7c968c40.836974";
var decoderNodeId = "634c3672.78be18";
var packerNodeId = "145f639d.4b63ac";
var converter1NodeId = "5c14afb6.b1cf3";
var converter2NodeId = "b1b36be1.4e4c98";
var converter3NodeId = "b5383380.4ac7d";
var converter4NodeId = "70208d26.8fdf74";
var multiviewerNodeId = "107c721c.8c951e";
var multiviewerConfigNodeId = "542ffc64.d42aa4";
var spoutNodeId = "f2186999.7e5f78";

TestUtil.nodeRedTest('A src->encoder->decoder->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  encodeFmt: 'h264',
  encodeBitrate: 5000000,
  encodeGopFrames: 5,
  encoderMaxBuffer: 10,
  decoderMaxBuffer: 10,
  spoutTimeout: 0
}, function getFlow(params) {
  var testFlow = JSON.parse(TestUtil.testNodes.baseTestFlow);
  testFlow.nodes[0] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[0].id = funnel1NodeId;
  testFlow.nodes[0].numPushes = params.numPushes;
  testFlow.nodes[0].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[0].wires[0][0] = encoderNodeId;

  testFlow.nodes[1] = JSON.parse(encodeTestNode);
  testFlow.nodes[1].id = encoderNodeId;
  testFlow.nodes[1].dstFormat = params.encodeFmt;
  testFlow.nodes[1].bitrate = params.encodeBitrate;
  testFlow.nodes[1].gopFrames = params.encodeGopFrames;
  testFlow.nodes[1].maxBuffer = params.encoderMaxBuffer;
  testFlow.nodes[1].wires[0][0] = decoderNodeId;

  testFlow.nodes[2] = JSON.parse(decodeTestNode);
  testFlow.nodes[2].id = decoderNodeId;
  testFlow.nodes[2].maxBuffer = params.decoderMaxBuffer;
  testFlow.nodes[2].wires[0][0] = spoutNodeId;

  testFlow.nodes[3] = JSON.parse(TestUtil.testNodes.spoutTestNode);
  testFlow.nodes[3].id = spoutNodeId;
  testFlow.nodes[3].timeout = params.spoutTimeout;
  testFlow.nodes[3].x = 700.0;
  return testFlow;
}, function onMsg(t, params, msgObj, onEnd) {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, `received end after expected number of pushes`);
    onEnd();
  }
});

TestUtil.nodeRedTest('A src->packer->spout flow is posted to Node-RED', {
  numPushes: 10,
  funnelMaxBuffer: 10,
  packerFmt: 'pgroup',
  packerMaxBuffer: 10,
  spoutTimeout: 0
}, function getFlow(params) {
  var testFlow = JSON.parse(TestUtil.testNodes.baseTestFlow);
  testFlow.nodes[0] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[0].id = funnel1NodeId;
  testFlow.nodes[0].numPushes = params.numPushes;
  testFlow.nodes[0].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[0].wires[0][0] = packerNodeId;

  testFlow.nodes[1] = JSON.parse(packerTestNode);
  testFlow.nodes[1].id = packerNodeId;
  testFlow.nodes[1].dstFormat = params.packerFmt;
  testFlow.nodes[1].maxBuffer = params.packerMaxBuffer;
  testFlow.nodes[1].wires[0][0] = spoutNodeId;

  testFlow.nodes[2] = JSON.parse(TestUtil.testNodes.spoutTestNode);
  testFlow.nodes[2].id = spoutNodeId;
  testFlow.nodes[2].timeout = params.spoutTimeout;
  testFlow.nodes[2].x = 500.0;
  return testFlow;
}, function onMsg(t, params, msgObj, onEnd) {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, `received end after expected number of pushes`);
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
}, function getFlow(params) {
  var testFlow = JSON.parse(TestUtil.testNodes.baseTestFlow);
  testFlow.nodes[0] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[0].id = funnel1NodeId;
  testFlow.nodes[0].numPushes = params.numPushes;
  testFlow.nodes[0].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[0].wires[0][0] = converter1NodeId;

  testFlow.nodes[1] = JSON.parse(converterTestNode);
  testFlow.nodes[1].id = converter1NodeId;
  testFlow.nodes[1].scaleX = 1.0;
  testFlow.nodes[1].scaleY = 1.0;
  testFlow.nodes[1].dstWidth = params.converterWidth;
  testFlow.nodes[1].dstHeight = params.converterHeight;
  testFlow.nodes[1].dstFormat = params.converterFmt;
  testFlow.nodes[1].maxBuffer = params.converterMaxBuffer;
  testFlow.nodes[1].wires[0][0] = spoutNodeId;

  testFlow.nodes[2] = JSON.parse(TestUtil.testNodes.spoutTestNode);
  testFlow.nodes[2].id = spoutNodeId;
  testFlow.nodes[2].timeout = params.spoutTimeout;
  testFlow.nodes[2].x = 500.0;
  return testFlow;
}, function onMsg(t, params, msgObj, onEnd) {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, `received end after expected number of pushes`);
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
}, function getFlow(params) {
  var i=0;
  var testFlow = JSON.parse(TestUtil.testNodes.baseTestFlow);
  testFlow.nodes[i] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[i].id = funnel1NodeId;
  testFlow.nodes[i].name = "funnel1",
  testFlow.nodes[i].numPushes = params.numPushes;
  testFlow.nodes[i].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[i].y = 100.0;
  testFlow.nodes[i].wires[0][0] = converter1NodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[i].id = funnel2NodeId;
  testFlow.nodes[i].name = "funnel2",
  testFlow.nodes[i].numPushes = params.numPushes;
  testFlow.nodes[i].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[i].y = 200.0;
  testFlow.nodes[i].wires[0][0] = converter2NodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[i].id = funnel3NodeId;
  testFlow.nodes[i].name = "funnel3",
  testFlow.nodes[i].numPushes = params.numPushes;
  testFlow.nodes[i].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[i].y = 300.0;
  testFlow.nodes[i].wires[0][0] = converter3NodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(TestUtil.testNodes.funnelGrainNode);
  testFlow.nodes[i].id = funnel4NodeId;
  testFlow.nodes[i].name = "funnel4",
  testFlow.nodes[i].numPushes = params.numPushes;
  testFlow.nodes[i].maxBuffer = params.funnelMaxBuffer;
  testFlow.nodes[i].y = 400.0;
  testFlow.nodes[i].wires[0][0] = converter4NodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(converterTestNode);
  testFlow.nodes[i].id = converter1NodeId;
  testFlow.nodes[i].name = "converter1",
  testFlow.nodes[i].multiviewSetup = multiviewerConfigNodeId;
  testFlow.nodes[i].scaleX = 1.0;
  testFlow.nodes[i].scaleY = 1.0;
  testFlow.nodes[i].maxBuffer = params.converterMaxBuffer;
  testFlow.nodes[i].y = 100.0;
  testFlow.nodes[i].wires[0][0] = multiviewerNodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(converterTestNode);
  testFlow.nodes[i].id = converter2NodeId;
  testFlow.nodes[i].name = "converter2",
  testFlow.nodes[i].multiviewSetup = multiviewerConfigNodeId;
  testFlow.nodes[i].scaleX = 1.0;
  testFlow.nodes[i].scaleY = 1.0;
  testFlow.nodes[i].maxBuffer = params.converterMaxBuffer;
  testFlow.nodes[i].y = 200.0;
  testFlow.nodes[i].wires[0][0] = multiviewerNodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(converterTestNode);
  testFlow.nodes[i].id = converter3NodeId;
  testFlow.nodes[i].name = "converter3",
  testFlow.nodes[i].multiviewSetup = multiviewerConfigNodeId;
  testFlow.nodes[i].scaleX = 1.0;
  testFlow.nodes[i].scaleY = 1.0;
  testFlow.nodes[i].maxBuffer = params.converterMaxBuffer;
  testFlow.nodes[i].y = 300.0;
  testFlow.nodes[i].wires[0][0] = multiviewerNodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(converterTestNode);
  testFlow.nodes[i].id = converter4NodeId;
  testFlow.nodes[i].name = "converter4",
  testFlow.nodes[i].multiviewSetup = multiviewerConfigNodeId;
  testFlow.nodes[i].scaleX = 1.0;
  testFlow.nodes[i].scaleY = 1.0;
  testFlow.nodes[i].maxBuffer = params.converterMaxBuffer;
  testFlow.nodes[i].y = 400.0;
  testFlow.nodes[i].wires[0][0] = multiviewerNodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(multiviewerTestNode);
  testFlow.nodes[i].id = multiviewerNodeId;
  testFlow.nodes[i].dstWidth = params.multiviewerWidth;
  testFlow.nodes[i].dstHeight = params.multiviewerHeight;
  testFlow.nodes[i].dstFormat = params.multiviewerFormat;
  testFlow.nodes[i].multiviewSetup = multiviewerConfigNodeId;
  testFlow.nodes[i].maxBuffer = params.multiviewerMaxBuffer;
  testFlow.nodes[i].x = 500.0;
  testFlow.nodes[i].wires[0][0] = spoutNodeId;
  ++i;
  testFlow.nodes[i] = JSON.parse(multiviewerConfigNode);
  testFlow.nodes[i].id = multiviewerConfigNodeId;
  testFlow.nodes[i].tiles = params.multiviewerTiles;
  ++i;
  testFlow.nodes[i] = JSON.parse(TestUtil.testNodes.spoutTestNode);
  testFlow.nodes[i].id = spoutNodeId;
  testFlow.nodes[i].timeout = params.spoutTimeout;
  testFlow.nodes[i].x = 700.0;
  return testFlow;
}, function onMsg(t, params, msgObj, onEnd) {
  //t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
    params.count++;
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    t.equal(params.count, params.numPushes, `received end after expected number of pushes`);
    onEnd();
  }
});
