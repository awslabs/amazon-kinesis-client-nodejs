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
 * Communicates with the MultiLangDaemon through the input and output files.
 */

var EventEmitter = require('events').EventEmitter;
var readline = require('readline');
var util = require('util');

/**
 * Creates an instance of the I/O handler.
 * @class IOHandler
 * @param {file} inputFile - A file to read input lines from.
 * @param {file} outputFile - A file to write output lines to.
 * @param {file} errorFile - A file to write error lines to.
 */
function IOHandler(inputFile, outputFile, errorFile) {
  this._inputFile = inputFile;
  this._outputFile = outputFile;
  this._errorFile = errorFile;

  this._readlineInterface = readline.createInterface(this._inputFile, this._outputFile);
  this._onInputLineCallback = this._onInputLine.bind(this);
  this._onInputCloseCallback = this._onInputClose.bind(this);
  this._readlineInterface.on('line', this._onInputLineCallback);
  this._readlineInterface.on('close', this._onInputCloseCallback);
}

/** @extends EventEmitter */
util.inherits(IOHandler, EventEmitter);

/**
 * Frees up any resources held by this instance.
 */
IOHandler.prototype.destroy = function() {
  this._readlineInterface.removeListener('line', this._onInputLineCallback);
  this._readlineInterface.removeListener('close', this._onInputCloseCallback);
  this._readlineInterface.close();
};

/**
 * Sends the string message to the MultiLangDaemon using the output stream.
 * @param {string} line - Line to send to the MultiLangDaemon.
 * @param {callback} callback - Callback that gets invoked on completion.
 */
IOHandler.prototype.writeLine = function(line, callback) {
  var result = this._outputFile.write(util.format('\n%s\n', line), 'utf8', callback);
  if (!result) {
    callback(util.format('Unable to write %s to file.', line));
  }
};

/**
 * Logs an error.
 * @param {string} error - Error to log.
 */
IOHandler.prototype.writeError = function(error) {
  this._errorFile.write(util.format('%s\n', error));
};

/**
 * Event handler for when a new line is received from the MultiLangDaemon through the input stream.
 @ @param {string} line - New line received.
 * @private
 */
IOHandler.prototype._onInputLine = function(line) {
  this.emit('line', line);
};

/**
 * Event handler for when the input stream is closed.
 * @private
 */
IOHandler.prototype._onInputClose = function() {
  this.emit('close');
};

/** @exports kcl/IOHandler */
module.exports = IOHandler;
