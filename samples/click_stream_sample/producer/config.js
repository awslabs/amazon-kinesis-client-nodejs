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
  kinesis : {
    // Region for the Amazon Kinesis stream.
    region : 'us-east-1'
  },

  clickStreamProducer : {
    // The Amazon Kinesis stream to ingest clickstream data into. If the specified
    // stream doesn't exist, the producer application creates a new stream.
    stream : 'kclnodejsclickstreamsample',

    // Total shards in the specified Amazon Kinesis stream.
    shards : 2,

    // The producer application batches clickstream records in to the size specified
    // here, and makes a single PutRecords API call to ingest all records to the
    // stream.
    recordsToWritePerBatch : 5,

    // If the producer application creates a stream, it has to wait for the stream to
    // transition to ACTIVE state before it can start putting data in it. This
    // specifies the wait time between consecutive describeStream calls.
    waitBetweenDescribeCallsInSeconds : 5,

    // Transactions per second for the PutRecords call to make sure the producer
    // doesn't hit throughput limits enforced by Amazon Kinesis.
    // For more information about throughput limits, see:
    // http://docs.aws.amazon.com/kinesis/latest/dev/service-sizes-and-limits.html
    putRecordsTps : 20
  }
};
