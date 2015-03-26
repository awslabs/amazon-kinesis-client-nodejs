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
 * Marshals and unmarshals actions and delegates them back and forth between the I/O handler
 * that talks to the MultiLangDaemon and the KCL manager.
 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Creates an instance of the action handler.
 * @class ActionHandler
 * @param {IOHandler} ioHandler - I/O handler instance that communicates with the MultiLangDaemon.
 */
function ActionHandler(ioHandler) {
  this._ioHandler = ioHandler;
  this._onIOLineCallback = this._onIOLine.bind(this);
  this._onIOCloseCallback = this._onIOClose.bind(this);
  this._ioHandler.on('line', this._onIOLineCallback);
  this._ioHandler.on('close', this._onIOCloseCallback);
}

/** @extends EventEmitter */
util.inherits(ActionHandler, EventEmitter);

/**
 * Frees up any resources held by this instance.
 */
ActionHandler.prototype.destroy = function() {
  this._ioHandler.removeListener('line', this._onIOLineCallback);
  this._ioHandler.removeListener('close', this._onIOCloseCallback);
};

/**
 * Sends an action to the MultiLangDaemon.
 * @param {object} action - Action to send to the MultiLangDaemon.
 * @param {callback} callback - Callback that will be invoked when the action is sent to the MultiLangDaemon.
 */
ActionHandler.prototype.sendAction = function(action, callback) {
  this._ioHandler.writeLine(JSON.stringify(action), callback);
};

/**
 * Event handler when a new line is received from the MultiLangDaemon through the I/O handler.
 * @param {string} line - New line received by IO handler.
 * @private
 */
ActionHandler.prototype._onIOLine = function(line) {
  if (line) {
    var action = JSON.parse(line);
    if (!action || !action.action) {
      this._ioHandler.writeError(util.format('Invalid action received: %s', line));
      return;
    }
    this.emit('action', action);
  }
};

/**
 * Event handler for the I/O close event. Following this event, no new lines will be received from the I/O handler.
 * @private
 */
ActionHandler.prototype._onIOClose = function() {
  this.emit('end');
};


/** @exports kcl/ActionHandler */
module.exports = ActionHandler;
