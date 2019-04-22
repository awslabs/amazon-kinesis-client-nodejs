/***
Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
***/

'use strict';

/**
 * @fileoverview
 * Keeps track of the MultiLangDaemon protocol. It implements the logic to move record processing forward and to
 * manage interactions with the record processor and MultiLangDaemon.
 */

var util = require('util');

var ActionHandler = require('./action_handler');
var Checkpointer = require('./checkpointer');
var IOHandler = require('./io_handler');

KCLManager.VERSION1 = Symbol("version1");
KCLManager.VERSION2 = Symbol("version2");

/**
 * Creates an instance of the KCL manager.
 * @class KCLManager
 * @param {object} kclManagerInput - Object containing the recordprocessor and the version of the record processor.
 * @param {file} inputFile - A file to read action messages from.
 * @param {file} outputFile - A file to write action messages to.
 * @param {file} errorfile - A file to write error messages to.
 */
function KCLManager(kclManagerInput, inputFile, outputFile, errorFile) {
  this._version = kclManagerInput.version;
  if (this._version === undefined) {
    this._version = KCLManager.VERSION2;
  }
  this._ioHandler = new IOHandler(inputFile, outputFile, errorFile);
  this._actionHandler = new ActionHandler(this._ioHandler);

  // this._stateMachine = new KCLStateMachine({});
  this._context = {
    recordProcessor: kclManagerInput.recordProcessor,
    checkpointer: new Checkpointer(this)
  };
}

/**
 * Event handler that gets invoked on a new action received from the MultiLangDaemon.
 * @param {object} action - Action received.
 * @private
 */
KCLManager.prototype._onAction = function(action) {
  var actionType = action.action;
  switch (actionType) {
    case 'initialize':
    case 'processRecords':
    case 'leaseLost':
    case 'shardEnded':
      this._onRecordProcessorAction(action);
      break;
    case 'checkpoint':
      this._onCheckpointAction(action);
      break;
    case 'shutdownRequested':
      this._onShutdownRequested(action);
      break;
    default:
      this._reportError(util.format('Invalid action received: %j', action));
  }
};

/**
 * Event handler that gets invoked when action handler has ended and no more action will be received.
 * @private
 */
KCLManager.prototype._onActionEnd = function() {
  // No more actions, so cleanup.
  this._cleanup();
};

/**
 * Record processing related action handler.
 * @param {object} action - Record processor related action.
 * @private
 */
KCLManager.prototype._onRecordProcessorAction = function(action) {
  var actionType = action.action;
  var context = this._context;
  var checkpointer = context.checkpointer;
  var recordProcessor = context.recordProcessor;
  var recordProcessorFuncInput = cloneToInput(action);
  var recordProcessorFunc;

  switch (actionType) {
    case 'initialize':
      recordProcessorFunc = recordProcessor.initialize;
      break;
    case 'processRecords':
      recordProcessorFuncInput.checkpointer = checkpointer;
      recordProcessorFunc = recordProcessor.processRecords;
      break;
    case 'leaseLost':
      if (this._version === KCLManager.VERSION1) {
        recordProcessorFuncInput.reason = 'ZOMBIE';
        recordProcessorFunc = recordProcessor.shutdown;
      } else {
        recordProcessorFunc = recordProcessor.leaseLost;
      }
      break;
    case 'shardEnded':
      recordProcessorFuncInput.checkpointer = checkpointer;
      if (this._version === KCLManager.VERSION1) {
        recordProcessorFuncInput.reason = 'TERMINATE';
        recordProcessorFunc = recordProcessor.shutdown;
      } else {
        recordProcessorFunc = recordProcessor.shardEnded;
      }
      break;
    default:
      // Should not occur.
      throw new Error(util.format('Invalid action for record processor: %j', action));
  }

  // Attach callback so user can mark that operation is complete, and KCL can proceed with new operation.
  var callbackFunc = function() {
    this._recordProcessorCallback(context, action);
  }.bind(this);

  recordProcessorFunc.apply(recordProcessor, [recordProcessorFuncInput, callbackFunc]);
};

/**
 * Clones the JSON action object into an input object that will be passed to the record processor function.
 * Note that only shallow copy is performed for efficiency.
 * @param {object} action - Record processor-related action.
 * @return Returns the cloned action object without the "action" attribute.
 * @private
 */
function cloneToInput(action) {
  var input = {};
  for (var attr in action) {
    if (attr !== 'action') {
      input[attr] = action[attr];
    }
  }
  return input;
}

/**
 * Gets invoked when the callback is received from the record processor suggesting that the record processor action
 * is complete.
 * @param {object} context - Context for which the record processor action is complete.
 * @param {object} action - Completed action.
 * @private
 */
KCLManager.prototype._recordProcessorCallback = function(context, action) {
  this._sendAction(context, {action : 'status', responseFor : action.action});
};

/**
 * Sends the given action to the MultiLangDaemon.
 * @param {object} context - Record processor context for which this action belongs to.
 * @param {object} action - Action to send.
 */
KCLManager.prototype._sendAction = function(context, action) {
  this._actionHandler.sendAction(action, function(err) {
    // If there is an error communicating with the MultiLangDaemon, then cannot proceed any further.
    if (err) {
      this._cleanup();
      throw new Error('Kinesis Client Library is in an invalid state. Cannot proceed further.');
    }
  }.bind(this));
};

/**
 * Checkpoint response action handler.
 * @param {object} action - Checkpoint response action.
 * @private
 */
KCLManager.prototype._onCheckpointAction = function(action) {
  var checkpointer = this._context.checkpointer;
  checkpointer.onCheckpointerResponse.apply(checkpointer, [action.error, action.sequenceNumber]);
};

/**
 * Checkpoints with given sequence number. The request is sent to the MultiLangDaemon.
 * @param {string} sequenceNumber - Sequence number to checkpoint.
 */
KCLManager.prototype.checkpoint = function(sequenceNumber) {
  this._sendAction(this._context, {action : 'checkpoint', sequenceNumber : sequenceNumber});
};

/**
 * Gets invoked when shutdownRequested is called.
 * @param {Object} action - RecordProcessor related action
 * @private
 */
KCLManager.prototype._onShutdownRequested = function(action) {
  var context = this._context;
  var recordProcessor = context.recordProcessor;
  var recordProcessorFunc = recordProcessor.shutdownRequested;

  if (typeof recordProcessorFunc === 'function') {
    var recordProcessorFuncInput = cloneToInput(action);
    var checkpointer = context.checkpointer;

    var callbackFunc = function() {
      this._recordProcessorCallback(context, action);
    }.bind(this);

    recordProcessorFuncInput.checkpointer = checkpointer;
    recordProcessorFunc.apply(recordProcessor, [recordProcessorFuncInput, callbackFunc]);
  }
  else {
    this._recordProcessorCallback(context, action);
  }
};

/**
 * Frees up any resources held by this instance.
 * @private
 */
KCLManager.prototype._cleanup = function() {
  this._actionHandler.removeListener('action', this._onActionCallback);
  this._actionHandler.removeListener('end', this._onActionEndCallback);
  this._actionHandler.destroy();
  this._ioHandler.destroy();
};

/**
 * Initiates the KCL processing.
 */
KCLManager.prototype.run = function() {
  if (!this._running) {
    this._running = true;
    this._onActionCallback = this._onAction.bind(this);
    this._onActionEndCallback = this._onActionEnd.bind(this);
    this._actionHandler.on('action', this._onActionCallback);
    this._actionHandler.on('end', this._onActionEndCallback);
  }
};

/** @exports kcl/KCLManager */
module.exports = KCLManager;
