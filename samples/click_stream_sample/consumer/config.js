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
