/***
Copyright 2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
***/

'use strict';


var chai = require('chai');
var expect = require('chai').expect;
var sinon = require('sinon');
var util = require('util');

var kcl = require('../..');

function RecordProcessor() {}

RecordProcessor.prototype.initialize = function(initializeInput, completeCallback) {
  completeCallback();
};

RecordProcessor.prototype.processRecords = function(processRecordsInput, completeCallback) {
  if (!processRecordsInput || !processRecordsInput.records) {
    completeCallback();
    return;
  }

  var records = processRecordsInput.records;
  var seq = records[0].sequenceNumber;
  var checkpointer = processRecordsInput.checkpointer;
  checkpointer.checkpoint(seq, function(err) {
    if (err) {
      checkpointer.checkpoint(seq, function(err) {
        completeCallback();
      });
    }
    else {
      completeCallback();
    }
  });
};

RecordProcessor.prototype.shutdown = function(shutdownInput, completeCallback) {
  completeCallback();
};

describe('kcl_process_tests', function() {
  var sandbox = null;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should initialize kcl and send back response', function(done) {
    var kclProcess = kcl(new RecordProcessor(), process.stdin, process.stdout, process.stderr);
    var inputSpec = {method : 'initialize', action : 'initialize', input : '{"action":"initialize","shardId":"shard-000001"}'};
    // Since we can't know when run() would finish processing all inputs, creating a stub for last call in the chain to force verification.
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function(data, cb) {
      // Verify that Initialize action was processed.
      expect(JSON.stringify(data)).to.equal(JSON.stringify({action : 'status', responseFor : inputSpec.action}));
      cb();
      kclProcess._kclManager._cleanup();
      done();
    });

    kclProcess.run();
    process.stdin.emit('data', inputSpec.input + '\n');
  });

  it('should not process records if not initialized', function(done) {
    var kclProcess = kcl(new RecordProcessor(), process.stdin, process.stdout, process.stderr);
    var inputSpec = {method : 'processRecords', action : 'processRecords', input : '{"action":"processRecords","records":[{"data":"bWVvdw==","partitionKey":"cat","sequenceNumber":"456"}]}'};

    try {
      kclProcess.run();
      process.stdin.emit('data', inputSpec.input + '\n');
    } catch(err) {
      kclProcess._kclManager._cleanup();
      expect(err.message).to.equal('Kinesis Client Library is in the invalid state. Cannot proceed further.');
      done();
    }
  });

  it('should not shutdown if not initialized', function(done) {
    var kclProcess = kcl(new RecordProcessor(), process.stdin, process.stdout, process.stderr);
    var inputSpec = {method : 'shutdown', action : 'shutdown', input : '{"action":"shutdown","reason":"TERMINATE"}'};

    try {
      kclProcess.run();
      process.stdin.emit('data', inputSpec.input + '\n');
    } catch(err) {
      kclProcess._kclManager._cleanup();
      expect(err.message).to.equal('Kinesis Client Library is in the invalid state. Cannot proceed further.');
      done();
    }
  });

  it('should process Initialize, one or more processRecords and shutdown in order', function(done) {
    var inputSpecs = {
      init: {method : 'initialize', action : 'initialize', input : '{"action":"initialize","shardId":"shard-000001"}'},
      process: {method : 'processRecords', action : 'processRecords', input : '{"action":"processRecords","records":[{"data":"bWVvdw==","partitionKey":"cat","sequenceNumber":"456"}]}'},
      shutdown: {method : 'shutdown', action : 'shutdown', input : '{"action":"shutdown","reason":"TERMINATE"}'},
    };

    var kclProcess = kcl(new RecordProcessor(), process.stdin, process.stdout, process.stderr);
    // Since we can't know when run() would finish processing all inputs, creating a stub for last call in the chain to force verification !
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function(data, cb) {
      cb();
      // MultiLangDaemon never sends a message until it receives reply for previous operation
      // send next action based on previous response !
      if (data.responseFor === 'initialize') {
        process.stdin.emit('data', inputSpecs.process.input + '\n');
      }
      else if (data.responseFor === 'processRecords') {
        process.stdin.emit('data', inputSpecs.shutdown.input + '\n');
      }
      else if (data.action === 'checkpoint') {
        process.stdin.emit('data', '{"action":"checkpoint","checkpoint":"456"}' + '\n');
      }
      else if (data.responseFor === 'shutdown') {
        kclProcess._kclManager._cleanup();
        done();
      }
    });

    kclProcess.run();
    process.stdin.emit('data', inputSpecs.init.input + '\n');
  });

  it('should process checkpoint error from MultiLangDaemon', function(done) {
    var inputSpecs = {
      init: {method : 'initialize', action : 'initialize', input : '{"action":"initialize","shardId":"shard-000001"}', resp : '{"action":"status","responseFor":"initialize"}'},
      process: {method : 'processRecords', action : 'processRecords', input : '{"action":"processRecords","records":[{"data":"bWVvdw==","partitionKey":"cat","sequenceNumber":"456"}]}', resp : '{"action":"status","responseFor":"processRecords"}'},
      checkpoint: {resp : '{"action":"checkpoint","checkpoint":"456"}'},
      shutdown: {method : 'shutdown', action : 'shutdown', input : '{"action":"shutdown","reason":"TERMINATE"}', resp : '{"action":"status","responseFor":"shutdown"}'},
    };

    var kclProcess = kcl(new RecordProcessor(), process.stdin, process.stdout, process.stderr);
    // Since we can't know when run() would finish processing all inputs, creating a stub for last call in the chain to force verification !
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function(data, cb) {
      cb();
      console.log(JSON.stringify(data));
      // MultiLangDaemon never sends a message until it receives reply for previous operation.
      // Send next action based on previous response.
      if (data.responseFor === 'initialize') {
        expect(JSON.stringify(data)).to.equal(inputSpecs.init.resp);
        process.stdin.emit('data', inputSpecs.process.input + '\n');
      }
      else if (data.responseFor === 'processRecords') {
        expect(JSON.stringify(data)).to.equal(inputSpecs.process.resp);
        process.stdin.emit('data', inputSpecs.shutdown.input + '\n');
      }
      else if (data.action === 'checkpoint') {
        expect(JSON.stringify(data)).to.equal(inputSpecs.checkpoint.resp);
        if (this.seen_checkpoint === undefined) {
          this.seen_checkpoint = 1;
          process.stdin.emit('data', '{"action":"checkpoint","checkpoint":"456","error":"ThrottlingException"}' + '\n');
        }
        else {
          this.seen_checkpoint++;
          process.stdin.emit('data', '{"action":"checkpoint","checkpoint":"456"}' + '\n');
        }
      }
      else if (data.responseFor === 'shutdown') {
        // Checkpoint should have been retried.
        expect(this.seen_checkpoint).to.equal(2);
        expect(JSON.stringify(data)).to.equal(inputSpecs.shutdown.resp);
        kclProcess._kclManager._ioHandler.destroy();
        done();
      }
      else {
        done('Error - invalid action passed to action handler: ' + data);
      }
    });

    kclProcess.run();
    process.stdin.emit('data', inputSpecs.init.input + '\n');
  });
});
