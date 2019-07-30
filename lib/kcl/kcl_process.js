/***
 Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 SPDX-License-Identifier: Apache-2.0
 ***/

'use strict';

/**
 * @fileoverview
 * Initializes record processing with the MultiLangDaemon.
 *
 * This KCL class takes the record processor that is responsible for processing a shard from an Amazon Kinesis stream.
 * The record processor must provide the following three methods:
 *
 * * `initialize` - Called once.
 * * `processRecords` - Called zero or more times.
 * * `shutdown` - Called if this MultiLangDaemon instance loses the lease to this shard.
 *
 * @example
 * var recordProcessor = {
 *
 *   initialize: function(initializeInput, completeCallback) {
 *     // Initialization logic here...
 *
 *     // Must call completeCallback when finished initializing in order to proceed further.
 *     completeCallback();
 *   },
 *
 *   processRecords: function(processRecordsInput, completeCallback) {
 *     // Record processing logic here...
 *
 *     // Note that if a checkpoint is invoked, only call completeCallback after the checkpoint operation is complete.
 *     completeCallback();
 *   },
 *
 *   leaseLost: function(leaseLostInput, completeCallback) {
 *      // Lease lostg logic here...
 *
 *      // Application can't checkpoint at this time as the lease was lost.
 *      completeCallback();
 *   }
 *
 *   shardEnded: function(shardEndedInput, completeCallback) {
 *     // Shard End logic here...
 *
 *     // Application needs to checkpoint at this time. Only call completeCallback after the checkpoint operation is
 *     // complete.
 *     completeCallback();
 *   }
 * };
 *
 * kcl(recordProcessor).run();
 *
 */

var KCLManager = require('./kcl_manager');

/**
 * Creates an instance of the KCL process.
 * @param {object} recordProcessor - A record processor to use for processing a shard.
 * @param {file} inputFile - A file to read action messages from. Defaults to STDIN.
 * @param {file} outputFile - A file to write action messages to. Defaults to STDOUT.
 * @param {file} errorfile - A file to write error messages to. Defaults to STDERR.
 */
function KCLProcess(recordProcessor, inputFile, outputFile, errorFile) {
  var allMethodsPresent = typeof recordProcessor.initialize === 'function' &&
    typeof recordProcessor.processRecords === 'function';
  allMethodsPresent = allMethodsPresent && ((typeof recordProcessor.leaseLost === 'function' &&
    typeof recordProcessor.shardEnded === 'function') || (typeof recordProcessor.shutdown === 'function'));
  if (!allMethodsPresent) {
    throw new Error('Record processor must implement initialize, processRecords, and shutdown functions.');
  }
  inputFile = typeof inputFile !== 'undefined' ? inputFile : process.stdin;
  outputFile = typeof outputFile !== 'undefined' ? outputFile : process.stdout;
  errorFile = typeof errorFile !== 'undefined' ? errorFile : process.stderr;

  var version = KCLManager.VERSION2;
  if (typeof recordProcessor.shutdown === 'function') {
    version = KCLManager.VERSION1;
  }

  var kclManagerInput = {
    recordProcessor: recordProcessor,
    version: version
  };

  var kclManager = new KCLManager(kclManagerInput, inputFile, outputFile, errorFile, version);

  return {
    // For testing only.
    _kclManager: kclManager,

    /**
     * Starts this KCL process's main loop.
     */
    run: function () {
      kclManager.run();
    },

    cleanup: function() {
      kclManager._cleanup();
    }
  };
}


/** @exports kcl/KCLProcess */
module.exports = KCLProcess;
