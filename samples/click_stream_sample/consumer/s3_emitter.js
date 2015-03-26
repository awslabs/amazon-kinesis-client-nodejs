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


var AWS = require('aws-sdk');
var util = require('util');
var logger = require('../../util/logger');

function s3Emitter(config) {
  var s3Client;
  var log = logger().getLogger('s3Emitter');
  var initializeRetryCount = 0;

  var self = {
    initialize: function(callback) {
      ++initializeRetryCount;

      s3Client = new AWS.S3({region: config.region});
      // Check if specified S3 bucket exists. If it does not, create one based one config.
      s3Client.headBucket({Bucket: config.bucket}, function(err, data) {
        if (!err) {
          log.info(util.format('Destination bucket: %s', config.bucket));
          callback(null);
          return;
        }
        if (!config.createBucketIfNotPresent) {
          callback('Specified bucket does not exist in S3. Enable bucket creation by setting config.s3.createBucketIfNotPresent to true.');
          return;
        }

        var params = {
          Bucket: config.bucket,
          CreateBucketConfiguration: {
            LocationConstraint: config.region
          }
        };
        s3Client.createBucket(params, function(err, data) {
          if (err && initializeRetryCount < 3) {
            setTimeout(function() {
              self.initialize(callback);
            }, 1000);
            return;
          }
          callback(err);
        });
      });
    },

    emit: function(key, value, callback) {
      var params = {
        Bucket: config.bucket,
        Key: key,
        Body: value
      };
      s3Client.upload(params, callback);
    }
  };
  return self;
}

module.exports = s3Emitter;
