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

var util = require('util');
var logger = require('../../util/logger');

function sampleProducer(kinesis, config) {
  var log = logger().getLogger('sampleProducer');

  function _createStreamIfNotCreated(callback) {
    var params = {
      ShardCount : config.shards,
      StreamName : config.stream
    };

    kinesis.createStream(params, function(err, data) {
      if (err) {
        if (err.code !== 'ResourceInUseException') {
          callback(err);
          return;
        }
        else {
          log.info(util.format('%s stream is already created. Re-using it.', config.stream));
        }
      }
      else {
        log.info(util.format("%s stream doesn't exist. Created a new stream with that name ..", config.stream));
      }

      // Poll to make sure stream is in ACTIVE state before start pushing data.
      _waitForStreamToBecomeActive(callback);
    });
  }

  function _waitForStreamToBecomeActive(callback) {
    kinesis.describeStream({StreamName : config.stream}, function(err, data) {
      if (!err) {
        log.info(util.format('Current status of the stream is %s.', data.StreamDescription.StreamStatus));
        if (data.StreamDescription.StreamStatus === 'ACTIVE') {
          callback(null);
        }
        else {
          setTimeout(function() {
            _waitForStreamToBecomeActive(callback);
          }, 1000 * config.waitBetweenDescribeCallsInSeconds);
        }
      }
    });
  }

  function _writeToKinesis() {
    var currTime = new Date().getMilliseconds();
    var sensor = 'sensor-' + Math.floor(Math.random() * 100000);
    var reading = Math.floor(Math.random() * 1000000);

    var record = JSON.stringify({
      time : currTime,
      sensor : sensor,
      reading : reading
    });

    var recordParams = {
      Data : record,
      PartitionKey : sensor,
      StreamName : config.stream
    };

    kinesis.putRecord(recordParams, function(err, data) {
      if (err) {
        log.error(err);
      }
      else {
        log.info('Successfully sent data to Kinesis.');
      }
    });
  }

  return {
    run: function() {
      _createStreamIfNotCreated(function(err) {
        if (err) {
          log.error(util.format('Error creating stream: %s', err));
          return;
        }
        var count = 0;
        while (count < 10) {
          setTimeout(_writeToKinesis(), 1000);
          count++;
        }
      });
    }
  };
}

module.exports = sampleProducer;
