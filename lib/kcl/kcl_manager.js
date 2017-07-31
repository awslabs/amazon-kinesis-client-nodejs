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


/**
 * @fileoverview
 * Keeps track of the MultiLangDaemon protocol. It implements the logic to move record processing forward and to
 * manage interactions with the record processor and MultiLangDaemon.
 */

var BehavioralFsm = require('machina').BehavioralFsm;
var util = require('util');

var ActionHandler = require('./action_handler');
var Checkpointer = require('./checkpointer');
var IOHandler = require('./io_handler');

/**
 * KCL state machine class responsible for maintaining the MultiLangDaemon protocol state.
 * @class KCLStateMachine
 * @private
 */
var KCLStateMachine = BehavioralFsm.extend({
  initialize: function(config) {
    this._actionHandler = config.actionHandler;
  },

  namespace: 'kcl-state-machine',
  initialState: 'Uninitialized',

  states: {
    Uninitialized: {
      '*': function(context) {
        this.deferUntilTransition(context);
        return true;
      }
    },
    Start: {
      beginInitialize: function(context) {
        this.transition(context, 'Initializing');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    Initializing: {
      finishInitialize: function(context) {
        this.transition(context, 'Ready');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    Ready: {
      beginProcessRecords: function(context) {
        this.transition(context, 'Processing');
        return true;
      },
      beginShutdownRequested: function(context) {
        this.transition(context, 'ShutdownRequested');
        return true;
      },
      beginShutdown: function(context) {
        this.transition(context, 'ShuttingDown');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    Processing: {
      beginCheckpoint: function(context) {
        this.transition(context, 'Checkpointing');
        return true;
      },
      finishProcessRecords: function(context) {
        this.transition(context, 'Ready');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    Checkpointing: {
      finishCheckpoint: function(context) {
        this.transition(context, 'Processing');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    ShutdownRequestedCheckpointing: {
      finishCheckpoint: function(context) {
        this.transition(context, 'ShutdownRequested');
        return true;
      },
      '*': function(context) {
        this.transition(context,  'Error');
        return false;
      }
    },
    ShutdownRequested: {
      beginCheckpoint: function(context) {
        this.transition(context, 'ShutdownRequestedCheckpointing');
        return true;
      },
      finishShutdownRequested: function(context) {
        this.transition(context, 'Ready');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    ShuttingDown: {
      beginCheckpoint: function(context) {
        this.transition(context, 'FinalCheckpointing');
        return true;
      },
      finishShutdown: function(context) {
        this.transition(context, 'End');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    FinalCheckpointing: {
      finishCheckpoint: function(context) {
        this.transition(context, 'ShuttingDown');
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    End: {
      cleanup: function(context) {
        return true;
      },
      '*': function(context) {
        this.transition(context, 'Error');
        return false;
      }
    },
    Error: {
      '*': function(context) {
        return false;
      }
    }
  }
});


/**
 * Creates an instance of the KCL manager.
 * @class KCLManager
 * @param {object} recordProcessor - A record processor to use for processing a shard.
 * @param {file} inputFile - A file to read action messages from.
 * @param {file} outputFile - A file to write action messages to.
 * @param {file} errorfile - A file to write error messages to.
 */
function KCLManager(recordProcessor, inputFile, outputFile, errorFile) {
  this._ioHandler = new IOHandler(inputFile, outputFile, errorFile);
  this._actionHandler = new ActionHandler(this._ioHandler);

  this._stateMachine = new KCLStateMachine({});
  this._context = {
    recordProcessor: recordProcessor,
    checkpointer: new Checkpointer(this)
  };

  this._onActionCallback = this._onAction.bind(this);
  this._onActionEndCallback = this._onActionEnd.bind(this);
  this._actionHandler.on('action', this._onActionCallback);
  this._actionHandler.on('end', this._onActionEndCallback);
}

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
    this._stateMachine.transition(this._context, 'Start');
  }
};

/**
 * Checkpoints with given sequence number. The request is sent to the MultiLangDaemon.
 * @param {string} sequenceNumber - Sequence number to checkpoint.
 */
KCLManager.prototype.checkpoint = function(sequenceNumber) {
  // Before invoking operation, first transition to make sure state is valid.
  this._handleStateInput(this._context, 'beginCheckpoint');

  this._sendAction(this._context, {action : 'checkpoint', sequenceNumber : sequenceNumber});
};

/**
 * Event handler that gets invoked on a new action received from the MultiLangDaemon.
 * @param {object} action - Action received.
 * @private
 */
KCLManager.prototype._onAction = function(action) {
  var actionType = action.action;
  if (actionType === 'initialize' ||
      actionType === 'processRecords' ||
      actionType === 'shutdown') {
    this._onRecordProcessorAction(action);
  }
  else if (actionType === 'checkpoint') {
    this._onCheckpointAction(action);
  }
  else if (actionType === 'shutdownRequested') {
    this._onShutdownRequested(action);
  }
  else {
    this._reportError(util.format('Invalid action received: %j', action));
  }
};

/**
 * Event handler that gets invoked when action handler has ended and no more action will be received.
 * @private
 */
KCLManager.prototype._onActionEnd = function() {
  // No more actions, so cleanup. If we are not in appropriate state for KCL to end, then error will be raised.
  this._handleStateInput(this._context, 'cleanup');
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
  var beginActionInput;
  var finishActionInput;

  if (actionType === 'initialize') {
    recordProcessorFunc = recordProcessor.initialize;
    beginActionInput = 'beginInitialize';
    finishActionInput = 'finishInitialize';
  }
  else if (actionType === 'processRecords') {
    recordProcessorFuncInput.checkpointer = checkpointer;
    recordProcessorFunc = recordProcessor.processRecords;
    beginActionInput = 'beginProcessRecords';
    finishActionInput = 'finishProcessRecords';
  }
  else if (actionType === 'shutdown') {
    recordProcessorFuncInput.checkpointer = checkpointer;
    recordProcessorFunc = recordProcessor.shutdown;
    beginActionInput = 'beginShutdown';
    finishActionInput = 'finishShutdown';
  }
  // Should not occur.
  else {
    throw new Error(util.format('Invalid action for record processor: %j', action));
  }

  // Before invoking the operation, first transition to make sure state is valid.
  this._handleStateInput(context, beginActionInput);

  // Attach callback so user can mark that operation is complete, and KCL can proceed with new operation.
  var callbackFunc = function() {
    this._recordProcessorCallback(context, action, finishActionInput);
  }.bind(this);

  recordProcessorFunc.apply(recordProcessor, [recordProcessorFuncInput, callbackFunc]);
};

/**
 * Gets invoked when the callback is received from the record processor suggesting that the record processor action
 * is complete.
 * @param {object} context - Context for which the record processor action is complete.
 * @param {object} action - Completed action.
 * @param {string} finishActionInput - Event input to pass to the state machine.
 * @private
 */
KCLManager.prototype._recordProcessorCallback = function(context, action, finishActionInput) {
  // Before invoking the operation, first transition to make sure state is valid.
  this._handleStateInput(context, finishActionInput);

  this._sendAction(context, {action : 'status', responseFor : action.action});
};

/**
 * Checkpoint response action handler.
 * @param {object} action - Checkpoint response action.
 * @private
 */
KCLManager.prototype._onCheckpointAction = function(action) {
  // Before invoking the operation, first transition to make sure state is valid.
  this._handleStateInput(this._context, 'finishCheckpoint');

  var checkpointer = this._context.checkpointer;
  checkpointer.onCheckpointerResponse.apply(checkpointer, [action.error, action.sequenceNumber]);
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

    this._handleStateInput(context, 'beginShutdownRequested');
    var callbackFunc = function() {
      this._recordProcessorCallback(context, action, 'finishShutdownRequested');
    }.bind(this);

    recordProcessorFuncInput.checkpointer = checkpointer;
    recordProcessorFunc.apply(recordProcessor, [recordProcessorFuncInput, callbackFunc]);
  }
  else {
    this._sendAction(context, {action: 'status', responseFor: action.action});
  }
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
      this._handleStateInput(context, 'error');
    }
  }.bind(this));
};

/**
 * Handles the input to the KCL state machine and transitions to the new state based on the input
 * and current state. If the input is not valid for the current state, then an exception is thrown.
 * @param {object} context - Context on which to perform the state machine operation.
 * @param {string} input - Input event to state machine.
 * @throws {Error} Exception is thrown if the input is invalid for current state.
 * @private
 */
KCLManager.prototype._handleStateInput = function(context, input) {
  var result = this._stateMachine.handle(context, input);
  if (!result) {
    // Clean-up since KCL cannot recover from invalid state and no longer can process more actions.
    this._cleanup();
    throw new Error('Kinesis Client Library is in the invalid state. Cannot proceed further.');
  }
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

/** @exports kcl/KCLManager */
module.exports = KCLManager;
