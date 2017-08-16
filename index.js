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

var config = require('./config.js');
var util = require('util');
var kcl = require("aws-kcl");
var logger = global.appLogger;

/**
 * The record processor must provide three functions:
 *
 * * `initialize` - called once
 * * `processRecords` - called zero or more times
 * * `shutdown` - called if this KCL instance loses the lease to this shard
 *
 * Notes:
 * * All of the above functions take additional callback arguments. When one is
 * done initializing, processing records, or shutting down, callback must be
 * called (i.e., `completeCallback()`) in order to let the KCL know that the
 * associated operation is complete. Without the invocation of the callback
 * function, the KCL will not proceed further.
 * * The application will terminate if any error is thrown from any of the
 * record processor functions. Hence, if you would like to continue processing
 * on exception scenarios, exceptions should be handled appropriately in
 * record processor functions and should not be passed to the KCL library. The
 * callback must also be invoked in this case to let the KCL know that it can
 * proceed further.
 */
var recordProcessor = {
  /**
   * Called once by the KCL before any calls to processRecords. Any initialization
   * logic for record processing can go here.
   *
   * @param {object} initializeInput - Initialization related information.
   *             Looks like - {"shardId":"<shard_id>"}
   * @param {callback} completeCallback - The callback that must be invoked
   *        once the initialization operation is complete.
   */
  initialize: function(initializeInput, completeCallback) {
    // Initialization logic ...
    logger.verbose('KCL Consumer initialized.');
    completeCallback();
  },

  /**
   * Called by KCL with a list of records to be processed and checkpointed.
   * A record looks like:
   *     {"data":"<base64 encoded string>","partitionKey":"someKey","sequenceNumber":"1234567890"}
   *
   * The checkpointer can optionally be used to checkpoint a particular sequence
   * number (from a record). If checkpointing, the checkpoint must always be
   * invoked before calling `completeCallback` for processRecords. Moreover,
   * `completeCallback` should only be invoked once the checkpoint operation
   * callback is received.
   *
   * @param {object} processRecordsInput - Process records information with
   *             array of records that are to be processed. Looks like -
   *             {"records":[<record>, <record>], "checkpointer":<Checkpointer>}
   *             where <record> format is specified above.
   * @param {Checkpointer} processRecordsInput.checkpointer - A checkpointer
   *             which accepts a `string` or `null` sequence number and a
   *             callback.
   * @param {callback} completeCallback - The callback that must be invoked
   *             once all records are processed and checkpoint (optional) is
   *             complete.
   */
  processRecords: function(processRecordsInput, completeCallback) {
    if (!processRecordsInput || !processRecordsInput.records) {
      // Must call completeCallback to proceed further.
      completeCallback();
      return;
    }

    var records = processRecordsInput.records;
    var record, sequenceNumber, partitionKey, data;
    for (var i = 0 ; i < records.length ; ++i) {
      record = records[i];
      sequenceNumber = record.sequenceNumber;
      partitionKey = record.partitionKey;
      // Note that "data" is a base64-encoded string. Buffer can be used to
      // decode the data into a string.
      data = new Buffer(record.data, 'base64').toString();
      logger.verbose(`ShardID: ${shardId}, Record: ${data}, SeqenceNumber: ${sequenceNumber}, ${partitionKey}`);
      // Custom record processing logic ...
    }
    if (!sequenceNumber) {
      // Must call completeCallback to proceed further.
      completeCallback();
      return;
    }
    // If checkpointing, only call completeCallback once checkpoint operation
    // is complete.
    processRecordsInput.checkpointer.checkpoint(sequenceNumber,
      function(err, checkpointedSequenceNumber) {
        // In this example, regardless of error, we mark processRecords
        // complete to proceed further with more records.
        completeCallback();
      }
    );
  },

  /**
   * Called by KCL to indicate that this record processor should shut down.
   * After shutdown operation is complete, there will not be any more calls to
   * any other functions of this record processor. Note that reason
   * could be either TERMINATE or ZOMBIE. If ZOMBIE, clients should not
   * checkpoint because there is possibly another record processor which has
   * acquired the lease for this shard. If TERMINATE, then
   * `checkpointer.checkpoint()` should be called to checkpoint at the end of
   * the shard so that this processor will be shut down and new processors
   * will be created for the children of this shard.
   *
   * @param {object} shutdownInput - Shutdown information. Looks like -
   *             {"reason":"<TERMINATE|ZOMBIE>", "checkpointer":<Checkpointer>}
   * @param {Checkpointer} shutdownInput.checkpointer - A checkpointer which
   *             accepts a `string` or `null` sequence number and a callback.
   * @param {callback} completeCallback - The callback that must be invoked
   *             once shutdown-related operations are complete and checkpoint
   *             (optional) is complete.
   */
  shutdown: function(shutdownInput, completeCallback) {
    // Shutdown logic ...

    if (shutdownInput.reason !== 'TERMINATE') {
      completeCallback();
      return;
    }
    // Since you are checkpointing, only call completeCallback once the checkpoint
    // operation is complete.
    shutdownInput.checkpointer.checkpoint(function(err) {
      // In this example, regardless of error, we mark the shutdown operation
      // complete.
      completeCallback();
    });
  }
};

logger.verbose('Running KCL Consumer');
kcl(recordProcessor).run();
