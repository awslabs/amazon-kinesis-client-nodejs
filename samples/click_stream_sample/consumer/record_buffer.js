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

// In memory buffer for storing kinesis records.
function recordBuffer(size) {
  var buffer = [];
  var firstSequenceNumber = 0;
  var lastSequenceNumber = 0;
  var totalRecords = 0;
  var currentSize = 0;
  var delimiter = '\n';

  function _clear() {
    buffer.length = 0;
    firstSequenceNumber = 0;
    lastSequenceNumber = 0;
    totalRecords = 0;
    currentSize = 0;
  }

  return {

    // Stores a single record in memory.
    putRecord: function(data, seq, callback) {
      if (!data) {
        return;
      }

      var record = new Buffer(data + delimiter);
      if (firstSequenceNumber === 0) {
        firstSequenceNumber = seq;
      }

      lastSequenceNumber = seq;

      currentSize += record.length;
      buffer.push(record);
    },

    // Bundles all records in a single buffer and clears local buffer.
    readAndClearRecords: function() {
      var buf =  new Buffer.concat(buffer, currentSize);
      _clear();
      return buf;
    },

    setDelimiter: function(delimiter) {
      delimiter = delimiter;
    },

    getFirstSequenceNumber: function() {
      return firstSequenceNumber;
    },

    getLastSequenceNumber: function() {
      return lastSequenceNumber;
    },

    shouldFlush: function() {
      if (currentSize >= size) {
        return true;
      }
    }
  };
}

module.exports = recordBuffer;
