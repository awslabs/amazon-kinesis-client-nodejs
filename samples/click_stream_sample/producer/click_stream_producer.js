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
var clickStreamGenerator = require('./click_stream_generator');
var logger = require('../../util/logger');

function clickStreamProducer(kinesis, config) {
  var clickStreamGen = clickStreamGenerator(config.shards);
  var log = logger().getLogger('producer');
  var waitBetweenPutRecordsCallsInMilliseconds = config.putRecordsTps ? 1000 / config.putRecordsTps : 50;

  // Creates a new kinesis stream if one doesn't exist.
  function _createStreamIfNotCreated(callback) {
    var params = {
      ShardCount: config.shards,
      StreamName: config.stream
    };

    kinesis.createStream(params, function(err, data) {
      if (err) {
        // ResourceInUseException is returned when the stream is already created.
        if (err.code !== 'ResourceInUseException') {
          callback(err);
          return;
        }
        else {
          log.info(util.format('%s stream is already created! Re-using it.', config.stream));
        }
      }
      else {
        log.info(util.format('%s stream does not exist. Created a new stream with that name.', config.stream));
      }

      // Poll to make sure stream is in ACTIVE state before start pushing data.
      _waitForStreamToBecomeActive(callback);
    });
  }

  // Checks current status of the stream.
  function _waitForStreamToBecomeActive(callback) {
    kinesis.describeStream({StreamName: config.stream}, function(err, data) {
      if (!err) {
        if (data.StreamDescription.StreamStatus === 'ACTIVE') {
          log.info('Current status of the stream is ACTIVE.');
          callback(null);
        }
        else {
          log.info(util.format('Current status of the stream is %s.', data.StreamDescription.StreamStatus));
          setTimeout(function() {
            _waitForStreamToBecomeActive(callback);
          }, 1000 * config.waitBetweenDescribeCallsInSeconds);
        }
      }
    });
  }

  // Sends batch of records to kinesis using putRecords API.
  function _sendToKinesis(totalRecords, done) {
    if (totalRecords <= 0) {
      return;
    }

    var data, record;
    var records = [];

    // Use putRecords API to batch more than one record.
    for (var i = 0 ; i < totalRecords ; i++) {
      data = clickStreamGen.getRandomClickStreamData();

      record = {
        Data: JSON.stringify(data),
        PartitionKey: data.resource
      };

      records.push(record);
    }

    var recordsParams = {
      Records: records,
      StreamName: config.stream
    };

    kinesis.putRecords(recordsParams, function(err, data) {
      if (err) {
        log.error(err);
      }
      else {
        log.info(util.format('Sent %d records with %d failures.', records.length, data.FailedRecordCount));
      }
    });

    done();
  }

  function _sendToKinesisRecursively(totalRecords) {
    setTimeout(function() {
      _sendToKinesis(totalRecords, function() {
        _sendToKinesisRecursively(totalRecords);
      });
    }, waitBetweenPutRecordsCallsInMilliseconds);
  }

  return {
    run: function() {
      log.info(util.format('Configured wait between consecutive PutRecords call in milliseconds: %d',
          waitBetweenPutRecordsCallsInMilliseconds));
      _createStreamIfNotCreated(function(err) {
        if (err) {
          log.error(util.format('Error creating stream: %s', err));
          return;
        }
        _sendToKinesisRecursively(config.recordsToWritePerBatch);
      });
    }
  };
}

module.exports = clickStreamProducer;
