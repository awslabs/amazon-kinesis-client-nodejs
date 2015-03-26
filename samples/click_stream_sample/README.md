# How to Process Clickstream Data Using Amazon Kinesis for Node.js

This README shows how to send a stream of records to [Amazon Kinesis][amazon-kinesis] through the implementation of an application that consumes and processes the records in near real time using the [Amazon Kinesis Client Library][amazon-kcl](KCL) for Node.js. The scenario for this README is to show how to ingest a stream of clickstream data and write a simple consumer using the KCL to process, batch, and upload data to Amazon S3 for further processing. This is a common use case for using Amazon Kinesis.

You can work through this README on your desktop or laptop and run both the producer and consumer code on the same machine. You can also run this sample on Amazon EC2 using the Amazon CloudFormation template provided.

Clickstream data is simulated in the sample code, and the clickstream data is evenly spread across all the shards of the Amazon Kinesis stream.

**Note:**

After you create a stream, your account incurs nominal charges for Amazon Kinesis usage because Amazon Kinesis is not eligible for the AWS free tier. After the consumer application starts, it also incurs nominal charges for Amazon DynamoDB usage. DynamoDB is used by the consumer application to track the processing state. When you are finished with this tutorial, delete your AWS resources to stop incurring charges. If you use the provided CloudFormation template to run this sample on Amazon EC2, the template takes care of cleaning up resources when you delete the associated CloudFormation stack.

## Before you start

* Before you begin, you need an AWS account. For more information about creating an AWS account and retrieving your AWS credentials, go to [AWS Security Credentials](http://docs.aws.amazon.com/general/latest/gr/aws-security-credentials.html).
* Familiarize yourself with Amazon Kinesis concepts such as streams, shards, producers, and consumers. For more information, see [Amazon Kinesis concepts](http://docs.aws.amazon.com/kinesis/latest/dev/key-concepts.html) and the tutorials.
* To run the sample code, you need Node.js, NPM installed on your computer. The Amazon KCL for Node.js uses the [MultiLangDaemon][multi-lang-daemon] provided by [Amazon KCL for Java][amazon-kcl-github]. To run the Amazon KCL for Node.js samples, you also need to install the [Java JDK](http://www.oracle.com/technetwork/java/javase/downloads/index.html).

## Producer

This section explains how to implement an application to ingest a continuous stream of clickstream data to Amazon Kinesis. This role is known as the Amazon Kinesis producer. You need to create a Amazon Kinesis stream to allow the producer to ingest data into Amazon Kinesis. The producer application creates a stream based on the configuration values in the file producer/config.js, or you can create your own from the [Amazon Kinesis console](https://console.aws.amazon.com/kinesis). If you create your own stream with a different name than the default in the sample code, edit the stream name in producer/config.js and the producer application will pick up that change.

### ClickStream producer

* Reads configuration and creates an Amazon Kinesis stream if the specified stream doesn't exist in the specified region.
* Waits for the stream to become ACTIVE by polling Amazon Kinesis using the describeStream operation.
* Continuously retrieves random clickstream data records, batches them up to a value specified by config.ClickStreamProducer.recordsToWritePerBatch, and makes a [PutRecords][nodejs-kinesis-putrecords] call to write all records to the Amazon Kinesis stream.

```javascript
// Use putRecords API to batch more than one record.
for (var i = 0; i < totalRecords; i++) {
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
    console.log(err);
  }
  else {
    console.log(util.format("Sent %d records with %d failures ..", records.length, data.FailedRecordCount));
  }
});
```

### Clickstream records

A clickstream record consists of a resource and a referrer.

```javascript
var data = {
  "resource": "resource-1",
  "referrer": "http://www.amazon.com/"
};
```

### Clickstream producer configuration

THe file producer/config.js file contains configurations supported by the producer application. It exposes the following configurations. You can change any configuration values in producer/config.js as needed.

```javascript
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
    putRecordsTps : 20
  }
};
```
For more information about throughput limits, see [Amazon Kinesis Limits](http://docs.aws.amazon.com/kinesis/latest/dev/service-sizes-and-limits.html).

### Run producer on a local computer

To run the data producer, execute the following commands from the root of the repository:

```sh
  cd samples/click_stream_sample/producer
  node click_stream_producer_app.js
```

**Note:**

To run a sample application on Amazon EC2, see the section 'Running on Amazon EC2' later in this README.

## Implement a basic processing application using the Amazon KCL for Node.js

This basic application processes records from an Amazon Kinesis stream using [nodejs-kcl][nodejs-kcl], batching records up to 1 MB (configurable) and sends them to a specified Amazon S3 bucket for further offline processing. You can extend this application to perform some processing on the data (e.g., a rolling window count) before sending data to S3. For more information, see [developing-consumer-applications-with-kcl][amazon-kcl].

### Clickstream consumer configuration
The consumer/config.js file contains configurations supported by the consumer application. It exposes The following configurations. You can change any configuration values in consumer/config.js as needed.

```javascript
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
```

### The consumer/Amazon KCL interface
The Amazon KCL for Node.js expects applications to pass an object that implements the following three functions:

* initialize
* processRecords
* shutdown

**Note:**

The Amazon KCL for Node.js uses stdin/stdout to interact with  the [MultiLangDaemon][multi-lang-daemon]. Do not point your application logs to stdout/stderr. If your logs point to stdout/stderr, the log output will get mingled with [MultiLangDaemon][multi-lang-daemon], which makes it really difficult to find consumer-specific log events. This consumer uses a logging library to redirect all application logs to a file called application.log. Make sure to follow a similar pattern while developing consumer applications with the Amazon KCL for Node.js. For more information about the protocol between  the MultiLangDaemon and Amazon KCL for Node.js, see [MultiLangDaemon][multi-lang-daemon].

```javascript
/**
 * A simple implementation of RecordProcessor that accepts records from an Amazon
 * Kinesis stream and batches them into 1 MB (configurable) datasets, then puts
 * them in a configured S3 bucket for further offline processing. The object
 * returned should implement the functions initialize, processRecords, and shutdown
 * in order to enable the KCL to interact with MultiLangDaemon.
 * MultiLangDaemon would create one child process (hence one RecordProcessor instance)
 * per shard. A single shard will never be accessed by more than one
 * RecordProcessor instance; e.g., if you run this sample on a single machine,
 * against a stream with 2 shards, MultiLangDaemon would create 2 child
 * Node.js processes (RecordProcessor), one for each shard.
 */
function clickStreamProcessor(emitter, cfg) {
  // return an object that implements the initialize, processRecords, and shutdown functions.
}
```

#### initialize(initializeInput, completeCallback)

```javascript
/**
 * This function is called by the KCL to allow application initialization before it
 * starts processing Amazon Kinesis records. The KCL won't start processing records until the
 * application is successfully initialized and completeCallback is called.
 */
initialize: function(initializeInput, completeCallback) {
  shardId = initializeInput.shardId;
  // The KCL for Node.js does not allow more than one outstanding checkpoint. So checkpoint must
  // be done sequentially. Async queue with 1 concurrency will allow executing checkpoints
  // one after another.
  commitQueue = async.queue(_commit, 1);

  emitter.initialize(function(err) {
    if (err) {
      log.error(util.format('Error initializing emitter: %s', err));
      process.exit(1);
    }
    else {
      log.info('Click stream processor successfully initialized.');
      completeCallback();
    }
  });
}
```

#### processRecords(processRecordsInput, completeCallback)

```javascript
/**
 * Called by the KCL with a list of records to be processed and a checkpointer.
 * A record looks like -
 * '{"data":"<base64 encoded string>","partitionKey":"someKey","sequenceNumber":"1234567890"}'
 * Note that "data" is a base64-encoded string. You can use  the Buffer class to decode the data
 * into a string. The checkpointer can be used to checkpoint a particular sequence number.
 * Any checkpoint call should be made before calling completeCallback. The KCL ingests the next
 * batch of records only after completeCallback is called.
 */
processRecords: function(processRecordsInput, completeCallback) {
  // Record processing...
  // Checkpoint if you need to.
  // call completeCallback() to allow the KCL to ingest the next batch of records.
}
```

In this sample, processRecords performs the following tasks:

* Receives one or more records from the KCL.
* Stores them in a local buffer
* Checks if the buffer has reached maxBufferSize; if yes, sends batched data to S3.
* Checkpoints after the data is successfully uploaded to S3.
* Calls completeCallback() after all records are stored in the buffer.
* Each call to processRecords may or may not call the checkpoint depending on whether the data was uploaded to S3. It checkpoints only after successfully uploading data to S3. This would be the most basic example of when an application should checkpoint after a unit of data is processed or persisted.

#### shutdown(shutdownInput, completeCallback)

```javascript
/**
 * Called by the KCL to indicate that this record processor should shut down.
 * After the shutdown operation is complete, there will not be any more calls to
 * any other functions of this record processor. Note that  the shutdown reason
 * could be either TERMINATE or ZOMBIE. If ZOMBIE, clients should not
 * checkpoint because there is possibly another record processor which has
 * acquired the lease for this shard. If TERMINATE, then
 * checkpointer.checkpoint() should be called to checkpoint at the end of
 * the shard so that this processor will be shut down and new processors
 * will be created for the children of this shard.
 */
shutdown: function(shutdownInput, completeCallback) {
  if (shutdownInput.reason !== 'TERMINATE') {
    completeCallback();
    return;
  }
  // Make sure to emit all remaining buffered data to S3 before shutting down.
  commitQueue.push({
    key: shardId + '/' + buffer.getFirstSequenceNumber() + '-' + buffer.getLastSequenceNumber(),
    sequenceNumber: buffer.getLastSequenceNumber(),
    data: buffer.readAndClearRecords(),
    checkpointer: shutdownInput.checkpointer
  }, function(error) {
    if (error) {
      log.error(util.format('Received error while shutting down: %s', error));
    }
    completeCallback();
  });
}
```

### Run the consumer on a local computer
Amazon KCL for Node.js uses the [MultiLangDaemon][multi-lang-daemon] provided by [Amazon KCL for Java][amazon-kcl-github]. For more information about how MultiLangDaemon interacts with the Amazon KCL for Node.js, see [MultiLangDaemon][multi-lang-daemon].

* By default, the MultiLangDaemon uses the [DefaultAWSCredentialsProviderChain][DefaultAWSCredentialsProviderChain], so you'll want to make your credentials available to one of the credentials providers in that provider  chain. There are several ways to do this. You can provide credentials through a '~/.aws/credentials' file or through environment variables (**AWS\_ACCESS\_KEY\_ID** and **AWS\_SECRET\_ACCESS\_KEY**). If you're running on Amazon EC2, you can associate an IAM role with your instance with appropriate access to Amazon Kinesis. If you use the CloudFormation template provided with sample application, it takes care of creating and associating the IAM role to your EC2 instances with the appropriate IAM policy.
* The kcl-bootstrap script at <REPOSITORY_ROOT>/bin/kcl-bootstrap downloads [MultiLangDaemon][multi-lang-daemon] and its dependencies. This bootstrap script invokes the [MultiLangDaemon][multi-lang-daemon], which starts the Node.js consumer application as its child process. By default, [MultiLangDaemon][multi-lang-daemon] uses a properties file to specify configurations for accessing the Amazon Kinesis stream. Take a look at the consumer/samples.properties file provided for list of options. Use the '-p' or '--properties' option to specify the properties file to use.
* The kcl-bootstrap script uses "JAVA_HOME" to locate the java binary. To specify your own java path, use the '-j' or '--java' argument when invoking the bootstrap script.
* Skip the '-e' or '--execute' argument to the bootstrap script, and it will only print the commands on the console to run the KCL application without actually running the KCL application.
* Add REPOSITORY_ROOT/bin to your path to access kcl-bootstrap from anywhere.
* Run the following command to find out all the options you can override when running the bootstrap script:

```sh
  kcl-bootstrap --help
```

* Run the following command to start the consumer application:

```sh
  cd samples/click_stream_sample/consumer
  kcl-bootstrap --java <path to java> -p ./sample.properties -e
```

**Note:**

To run a sample application on Amazon EC2, see the section 'Running on Amazon EC2' later in this README.

### Cleaning up
This sample application creates an Amazon Kinesis stream, ingests data into it, and creates an Amazon DynamoDB table to track the KCL application state. It may also create an S3 bucket to store batched clickstream data. Your AWS account will incur nominal costs for these resources. After you are done, you can log in to the AWS Management Console and delete these resources. Specifically, the sample application creates the following AWS resources:

* An *Amazon Kinesis stream* provided in the config.js file.
* An *Amazon DynamoDB table* with same name as applicationName provided in sample.properties.
* An *Amazon S3 bucket* provided in the config.js file.

## Running on Amazon EC2
To make running this sample on Amazon EC2 easier, we have provided an Amazon CloudFormation template that creates an Amazon Kinesis stream, an S3 bucket, an appropriate IAM role and policy, and Auto Scaling groups for consumers and producers. You can use this template to create a CloudFormation stack. Make sure to use same AWS region that you have specified in the config.js file (the region defaults to us-east-1, but you can use any region that supports Amazon Kinesis). This CloudFormation template also takes care of downloading and starting producer and consumer applications on EC2 instances.

After the template is created, you can:

* Log on to producer instances, go to samples/click_stream_sample/producer, and look at logs/application.log for logs.
* Log on to consumer instances, go to samples/click_stream_sample/consumer, and look at consumer.out for multi-lang-daemon logs and logs/application.log for consumer logs.
* View batched clickstream data in S3 under the specified S3 bucket.

After you are done with testing the sample application, you can delete the CloudFormation script and it should take care of cleaning up the AWS resources created. Keep in mind the following:

* Just as with the manually-run scenario, this stack ingests data into Amazon Kinesis, stores metadata in DynamoDB, and stores clickstream data in S3, all of which will result in a nominal AWS resource cost. This is especially important if you are planning to run the CloudFormation script for a longer duration.
* You can use ProducerPutRecordsBatchSize and ProducerPutRecordsTps to decide how fast to ingest data into Amazon Kinesis. A lower number for both of these parameters will result in a slower data ingestion rate.
* You must delete all files in the S3 bucket before deleting the CloudFormation script because CloudFormation only deletes empty S3 buckets.

## Summary

Processing a large amount of data in near real time does not require writing any complex code or developing a huge infrastructure. It is as simple as writing logic to process a small amount of data (like writing processRecord(Record)) and letting Amazon Kinesis scale for you so that it works for a large amount of streaming data. You don’t have to worry about how your processing would scale because Amazon Kinesis handles it for you. Spend your time designing and developing the logic for your ingestion (producer) and processing (consumer), and let Amazon Kinesis do the rest.

## Next steps
* For more information about the KCL, see [Developing Consumer Applications for Amazon Kinesis using the Amazon Kinesis Client Library][amazon-kcl].
* For more information about how to optimize your application, see [Advanced Topics for Amazon Kinesis Applications][advanced-kcl-topics].

[amazon-kinesis]: http://aws.amazon.com/kinesis
[amazon-kcl-github]: https://github.com/awslabs/amazon-kinesis-client
[amazon-kinesis-docs]: http://aws.amazon.com/documentation/kinesis/
[amazon-kinesis-shard]: http://docs.aws.amazon.com/kinesis/latest/dev/key-concepts.html
[amazon-kcl]: http://docs.aws.amazon.com/kinesis/latest/dev/developing-consumer-apps-with-kcl.html
[nodejs-kinesis-putrecords]: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html#putRecords-property
[nodejs-kcl]: https://github.com/awslabs/amazon-kinesis-client-nodejs
[advanced-kcl-topics]: http://docs.aws.amazon.com/kinesis/latest/dev/kinesis-record-processor-advanced.html
[aws-sdk-node]: http://aws.amazon.com/sdk-for-node-js/
[multi-lang-daemon]: https://github.com/awslabs/amazon-kinesis-client/blob/master/src/main/java/com/amazonaws/services/kinesis/multilang/package-info.java
[DefaultAWSCredentialsProviderChain]: http://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/auth/DefaultAWSCredentialsProviderChain.html
[kinesis-forum]: http://developer.amazonwebservices.com/connect/forum.jspa?forumID=169
[aws-console]: http://aws.amazon.com/console/
