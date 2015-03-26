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


var async = require('async');
var util = require('util');
var config = require('./config');
var kcl = require('../../..');
var logger = require('../../util/logger');
var recordBuffer = require('./record_buffer');
var s3Emitter = require('./s3_emitter');


/**
 * A simple implementation of RecordProcessor that accepts records from an Amazon
 * Kinesis stream and batches them into 1 MB (configurable) datasets, then puts
 * them in a configured S3 bucket for further offline processing. The object
 * returned should implement the functions initialize, processRecords, and shutdown
 * in order to enable the KCL to interact with MultiLangDaemon.
 * MultiLangDaemon would create one child process (hence one RecordProcessor instance)
 * per shard. A single shard will never be accessed by more than one
 * RecordProcessor instance; e.g., if you run this sample on a single machine,
 * against a stream with 2 shards, MultiLangDaemon would create 2 child
 * Node.js processes (RecordProcessor), one for each shard.
 */
function clickStreamProcessor(emitter, cfg) {
  var buffer = recordBuffer(cfg.maxBufferSize);
  var log = logger().getLogger('clickStreamProcessor');
  var shardId = null;
  var commitQueue = null;

  function _commit(commitInfo, callback) {
    var key = commitInfo.key;
    var sequenceNumber = commitInfo.sequenceNumber;
    var data = commitInfo.data;
    var checkpointer = commitInfo.checkpointer;
    emitter.emit(key, data, function(error) {
      if (error) {
        callback(error);
        return;
      }
      log.info(util.format('Successfully uploaeded data to s3 file: %s', key));
      checkpointer.checkpoint(sequenceNumber, function(e, seq) {
        if (!e) {
          log.info('Successful checkpoint at sequence number: %s', sequenceNumber);
        }
        callback(e);
      });
    });
  }

  function _processRecord(record, checkpointer, callback) {
    var data = new Buffer(record.data, 'base64').toString();
    var sequenceNumber = record.sequenceNumber;

    // Add data to buffer until maxBufferSize.
    buffer.putRecord(data, sequenceNumber);

    if (!buffer.shouldFlush()) {
      callback(null);
      return;
    }
    // Buffer is full. Add commit to the queue.
    commitQueue.push({
      key: shardId + '/' + buffer.getFirstSequenceNumber() + '-' + buffer.getLastSequenceNumber(),
      sequenceNumber: buffer.getLastSequenceNumber(),
      data: buffer.readAndClearRecords(),
      checkpointer: checkpointer
    }, callback);
  }

  return {
    /**
     * This function is called by the KCL to allow application initialization before it
     * starts processing Amazon Kinesis records. The KCL won't start processing records until the
     * application is successfully initialized and completeCallback is called.
     */
    initialize: function(initializeInput, completeCallback) {
      shardId = initializeInput.shardId;
      // The KCL for Node.js does not allow more than one outstanding checkpoint. So checkpoint must
      // be done sequentially. Async queue with 1 concurrency will allow executing checkpoints
      // one after another.
      commitQueue = async.queue(_commit, 1);

      emitter.initialize(function(err) {
        if (err) {
          log.error(util.format('Error initializing emitter: %s', err));
          process.exit(1);
        }
        else {
          log.info('Click stream processor successfully initialized.');
          completeCallback();
        }
      });
    },

    /**
     * Called by the KCL with a list of records to be processed and a checkpointer.
     * A record looks like -
     * '{"data":"<base64 encoded string>","partitionKey":"someKey","sequenceNumber":"1234567890"}'
     * Note that "data" is a base64-encoded string. You can use  the Buffer class to decode the data
     * into a string. The checkpointer can be used to checkpoint a particular sequence number.
     * Any checkpoint call should be made before calling completeCallback. The KCL ingests the next
     * batch of records only after completeCallback is called.
     */
    processRecords: function(processRecordsInput, completeCallback) {
      if (!processRecordsInput || !processRecordsInput.records) {
        completeCallback();
        return;
      }

      var records = processRecordsInput.records;
      // Call completeCallback only after we have processed all records.
      async.series([
        function(done) {
          var record;
          var processedCount = 0;
          var errorCount = 0;
          var errors;

          var callback = function (err) {
            if (err) {
              log.error(util.format('Received error while processing record: %s', err));
              errorCount++;
              errors = errors + '\n' + err;
            }

            processedCount++;
            if (processedCount === records.length) {
              done(errors, errorCount);
            }
          };

          for (var i = 0 ; i < records.length ; ++i) {
            record  = records[i];
            _processRecord(record, processRecordsInput.checkpointer, callback);
          }
        }
      ],
      function(err, errCount) {
        if (err) {
          log.info(util.format('%d records processed with %d errors.', records.length, errCount));
        }
        completeCallback();
      });
    },

    /**
     * Called by the KCL to indicate that this record processor should shut down.
     * After the shutdown operation is complete, there will not be any more calls to
     * any other functions of this record processor. Note that  the shutdown reason
     * could be either TERMINATE or ZOMBIE. If ZOMBIE, clients should not
     * checkpoint because there is possibly another record processor which has
     * acquired the lease for this shard. If TERMINATE, then
     * checkpointer.checkpoint() should be called to checkpoint at the end of
     * the shard so that this processor will be shut down and new processors
     * will be created for the children of this shard.
     */
    shutdown: function(shutdownInput, completeCallback) {
      if (shutdownInput.reason !== 'TERMINATE') {
        completeCallback();
        return;
      }
      // Make sure to emit all remaining buffered data to S3 before shutting down.
      commitQueue.push({
        key: shardId + '/' + buffer.getFirstSequenceNumber() + '-' + buffer.getLastSequenceNumber(),
        sequenceNumber: buffer.getLastSequenceNumber(),
        data: buffer.readAndClearRecords(),
        checkpointer: shutdownInput.checkpointer
      }, function(error) {
        if (error) {
          log.error(util.format('Received error while shutting down: %s', error));
        }
        completeCallback();
      });
    }
  };
}

kcl(clickStreamProcessor(s3Emitter(config.s3), config.clickStreamProcessor)).run();
