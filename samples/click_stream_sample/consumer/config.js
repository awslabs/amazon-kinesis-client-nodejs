/***
Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
***/

'use strict';

var config = module.exports = {
  s3 : {
    // Region for Amazon S3. Defaults to us-east-1.
    // region : '',

    // Amazon S3 bucket to store batched clickstream data. The consumer application
    // may create a new bucket (based on S3.createBucketIfNotPresent value),
    // if the specified bucket doesn't exist.
    bucket : 'kinesis-clickstream-batchdata',

    // Enables the consumer application to create a new S3 bucket if the specified
    // bucket doesn't exist.
    createBucketIfNotPresent : true
  },

  clickStreamProcessor : {
    // Maximum batch size in bytes before sending data to S3.
    maxBufferSize : 1024 * 1024
  }
};
