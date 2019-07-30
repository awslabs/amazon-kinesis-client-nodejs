/***
 Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 SPDX-License-Identifier: Apache-2.0
 ***/

'use strict';

var chai = require('chai');
var expect = require('chai').expect;
var sinon = require('sinon');
var util = require('util');

var kcl = require('../..');

function RecordProcessor() {
}

RecordProcessor.prototype.initialize = function (initializeInput, completeCallback) {
  completeCallback();
};

RecordProcessor.prototype.processRecords = function (processRecordsInput, completeCallback) {
  if (!processRecordsInput || !processRecordsInput.records) {
    completeCallback();
    return;
  }

  var records = processRecordsInput.records;
  var seq = records[0].sequenceNumber;
  var checkpointer = processRecordsInput.checkpointer;
  checkpointer.checkpoint(seq, function (err) {
    if (err) {
      checkpointer.checkpoint(seq, function (err) {
        completeCallback();
      });
    } else {
      completeCallback();
    }
  });
};

RecordProcessor.prototype.leaseLost = function (shutdownInput, completeCallback) {
  completeCallback();
};

RecordProcessor.prototype.shardEnded = function (shardEndedInput, completeCallback) {
  completeCallback();
};

describe('kcl_process_tests', function () {
  var sandbox = null;
  var kclProcess = null;

  var initialize = {action: 'initialize', shardId: 'shardId-000000000001'};
  var initializeString = JSON.stringify(initialize) + '\n';
  var initializeResponse = JSON.stringify({action: 'status', responseFor: initialize.action});

  var processRecords = {
    action: 'processRecords',
    records: [{'data': 'bWVvdw==', 'partitionKey': 'cat', 'sequenceNumber': '456'}]
  };
  var processRecordsString = JSON.stringify(processRecords) + '\n';
  var processRecordsResponse = JSON.stringify({action: 'status', responseFor: processRecords.action});

  var checkpoint = {action: 'checkpoint', sequenceNumber: '456'};
  var checkpointString = JSON.stringify(checkpoint);
  var checkpointResponse = JSON.stringify({action: checkpoint.action, checkpoint: checkpoint.sequenceNumber}) + '\n';

  var shardEnded = {action: 'shardEnded'};
  var shardEndedString = JSON.stringify(shardEnded) + '\n';
  var shardEndedResponse = JSON.stringify({action: 'status', responseFor: shardEnded.action});

  beforeEach(function () {
    kclProcess = kcl(new RecordProcessor());
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    kclProcess.cleanup();
    sandbox.restore();
  });

  it('should initialize kcl and send back response', function (done) {
    // Since we can't know when run() would finish processing all inputs, creating a stub for last call in the chain to force verification.
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function (data, callback) {
      let dataString = JSON.stringify(data);
      console.log('Got response: ' + dataString);
      callback();

      // Verify that Initialize action was processed.
      expect(dataString).to.equal(initializeResponse);
      done();
    });

    kclProcess.run();
    process.stdin.emit('data', initializeString);
  });

  it('should process records, checkpoint and then send back response', function (done) {
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function (data, callback) {
      let dataString = JSON.stringify(data);
      console.log('Got response: ' + dataString);
      callback();

      switch (data.action) {
        case 'status':
          expect(dataString).to.equal(processRecordsResponse);
          done();
          break;
        case 'checkpoint':
          expect(dataString).to.equal(checkpointString);
          kclProcess._kclManager._ioHandler.emit('line', checkpointResponse);
          break;
        default:
          throw new Error('Should not happen ' + dataString);
      }
    });

    kclProcess.run();
    kclProcess._kclManager._ioHandler.emit('line', processRecordsString);
  });

  it('should invoke shardEnd and send back response', function (done) {
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function (data, callback) {
      let dataString = JSON.stringify(data);
      console.log('Got response: ' + dataString);
      expect(dataString).to.equal(shardEndedResponse);
      callback();
      done();
    });

    kclProcess.run();
    kclProcess._kclManager._ioHandler.emit('line', shardEndedString);
  });

  it('should process Initialize, one or more processRecords and shutdown in order', function (done) {
    // Since we can't know when run() would finish processing all inputs, creating a stub for last call in the chain to force verification !
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function (data, callback) {
      let dataString = JSON.stringify(data);
      console.log('Got response: ' + dataString);
      callback();
      // MultiLangDaemon never sends a message until it receives reply for previous operation
      // send next action based on previous response !
      switch (data.action) {
        case 'status':
          switch (data.responseFor) {
            case 'initialize':
              expect(dataString).to.equal(initializeResponse);
              kclProcess._kclManager._ioHandler.emit('line', processRecordsString);
              break;
            case 'processRecords':
              expect(dataString).to.equal(processRecordsResponse);
              kclProcess._kclManager._ioHandler.emit('line', shardEndedString);
              break;
            case 'shardEnded':
              expect(dataString).to.equal(shardEndedResponse);
              done();
              break;
            default:
              throw new Error('Should not happen ' + dataString);
          }
          break;
        case 'checkpoint':
          expect(dataString).to.equal(checkpointString);
          kclProcess._kclManager._ioHandler.emit('line', checkpointResponse);
          break;
        default:
          throw new Error('Should not happen ' + dataString);
      }
    });

    kclProcess.run();
    kclProcess._kclManager._ioHandler.emit('line', initializeString);
  });

  it('should process checkpoint error from MultiLangDaemon', function (done) {
    // Since we can't know when run() would finish processing all inputs, creating a stub for last call in the chain to force verification !
    sandbox.stub(kclProcess._kclManager._actionHandler, 'sendAction', function (data, callback) {
      let dataString = JSON.stringify(data);
      console.log('Got response: ' + dataString);
      callback();
      // MultiLangDaemon never sends a message until it receives reply for previous operation.
      // Send next action based on previous response.

      switch (data.action) {
        case 'status':
          switch (data.responseFor) {
            case 'initialize':
              expect(dataString).to.equal(initializeResponse);
              kclProcess._kclManager._ioHandler.emit('line', processRecordsString);
              console.log('Emitted ' + processRecordsString);
              break;
            case 'processRecords':
              expect(dataString).to.equal(processRecordsResponse);
              kclProcess._kclManager._ioHandler.emit('line', shardEndedString);
              break;
            case 'shardEnded':
              // Checkpoint should have been retried.
              expect(this.seen_checkpoint).to.equal(2);
              expect(dataString).to.equal(shardEndedResponse);
              done();
              break;
            default:
              throw new Error('Should not happen ' + dataString);
          }
          break;
        case 'checkpoint':
          expect(dataString).to.equal(checkpointString);
          if (this.seen_checkpoint === undefined) {
            this.seen_checkpoint = 1;
            var errorResponse = JSON.parse(checkpointResponse);
            errorResponse.error = 'ThrottlingException';
            kclProcess._kclManager._ioHandler.emit('line', JSON.stringify(errorResponse) + '\n');
          } else {
            this.seen_checkpoint++;
            kclProcess._kclManager._ioHandler.emit('line', checkpointResponse);
          }
          break;
        default:
          throw new Error('Should not happen ' + dataString);
      }
    });

    kclProcess.run();
    kclProcess._kclManager._ioHandler.emit('line', initializeString);
  });
});
