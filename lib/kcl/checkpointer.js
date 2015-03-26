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
 * Allows you to make checkpoint requests. A checkpoint marks a point in a shard until which all records are processed
 * successfully. If this MultiLangDaemon KCL application instance shuts down for whatever reason, then another instance
 * of the same KCL application resumes processing for this shard after the most recent checkpoint.
 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');


/**
 * Creates an instance of the checkpointer.
 * @class Checkpointer
 * @param {KCLManager} kclManager - Main KCL manager instance that keeps track of current state and dispatches all
 *                                  processing functions.
 */
function Checkpointer(kclManager) {
  this._kclManager = kclManager;
  this._callback  = null;
}

/**
 * Checkpoints at a given sequence number. If the sequence number is not provided, the checkpoint will be at the end of
 * the most recently-delivered list of records.
 * @param {string} [sequenceNumber] - Sequence number of the record to checkpoint; if this value is not provided, the
 *                                    latest retrieved record is checkpointed.
 * @param {callback} callback - Function that is invoked after the checkpoint operation completes.
 */
Checkpointer.prototype.checkpoint = function(sequenceNumber, callback) {
  if (typeof sequenceNumber === 'function') {
    callback = sequenceNumber;
    sequenceNumber = null;
  }

  if (this._callback) {
    callback('Cannot checkpoint while another checkpoint is already in progress.');
    return;
  }
  this._callback = callback;
  this._kclManager.checkpoint(sequenceNumber);
};

/**
 * Gets called by the KCL manager when an outstanding checkpoint request completes either successfully or with
 * an error. This function then invokes the callback passed by the user when the checkpoint was requested.
 * @param {string} err - Error message if the checkpoint request was unsuccessful.
 * @param {string} sequenceNumber - Sequence number for which the checkpoint response is received.
 * @ignore
 */
Checkpointer.prototype.onCheckpointerResponse = function(err, sequenceNumber) {
  var callback = this._callback;
  this._callback = null;
  callback(err, sequenceNumber);
};

/** @exports kcl/Checkpointer */
module.exports = Checkpointer;
