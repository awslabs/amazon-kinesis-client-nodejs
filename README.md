# Amazon Kinesis Client Library for Node.js

This package provides an interface to the [Amazon Kinesis Client Library][amazon-kcl] (KCL) [MultiLangDaemon][multi-lang-daemon] for the Node.js framework.

Developers can use the KCL to build distributed applications that process streaming data reliably at scale. The KCL takes care of many of the complex tasks associated with distributed computing, such as load-balancing across multiple instances, responding to instance failures, checkpointing processed records, and reacting to changes in stream volume.

This package wraps and manages the interaction with the [MultiLangDaemon][multi-lang-daemon], which is provided as part of the [Amazon KCL for Java][amazon-kcl-github] so that developers can focus on implementing their record processing logic.

A record processor in Node.js typically looks like the following:

```javascript
var kcl = require('aws-kcl');
var util = require('util');

/**
 * The record processor must provide three functions:
 *
 * * `initialize` - called once
 * * `processRecords` - called zero or more times
 * * `shutdown` - called if this KCL instance loses the lease to this shard
 *
 * Notes:
 * * All of the above functions take additional callback arguments. When one is
 * done initializing, processing records, or shutting down, callback must be
 * called (i.e., `completeCallback()`) in order to let the KCL know that the
 * associated operation is complete. Without the invocation of the callback
 * function, the KCL will not proceed further.
 * * The application will terminate if any error is thrown from any of the
 * record processor functions. Hence, if you would like to continue processing
 * on exception scenarios, exceptions should be handled appropriately in
 * record processor functions and should not be passed to the KCL library. The
 * callback must also be invoked in this case to let the KCL know that it can
 * proceed further.
 */
var recordProcessor = {
  /**
   * Called once by the KCL before any calls to processRecords. Any initialization
   * logic for record processing can go here.
   *
   * @param {object} initializeInput - Initialization related information.
   *             Looks like - {"shardId":"<shard_id>"}
   * @param {callback} completeCallback - The callback that must be invoked
   *        once the initialization operation is complete.
   */
  initialize: function(initializeInput, completeCallback) {
    // Initialization logic ...

    completeCallback();
  },

  /**
   * Called by KCL with a list of records to be processed and checkpointed.
   * A record looks like:
   *     {"data":"<base64 encoded string>","partitionKey":"someKey","sequenceNumber":"1234567890"}
   *
   * The checkpointer can optionally be used to checkpoint a particular sequence
   * number (from a record). If checkpointing, the checkpoint must always be
   * invoked before calling `completeCallback` for processRecords. Moreover,
   * `completeCallback` should only be invoked once the checkpoint operation
   * callback is received.
   *
   * @param {object} processRecordsInput - Process records information with
   *             array of records that are to be processed. Looks like -
   *             {"records":[<record>, <record>], "checkpointer":<Checkpointer>}
   *             where <record> format is specified above.
   * @param {Checkpointer} processRecordsInput.checkpointer - A checkpointer
   *             which accepts a `string` or `null` sequence number and a
   *             callback.
   * @param {callback} completeCallback - The callback that must be invoked
   *             once all records are processed and checkpoint (optional) is
   *             complete.
   */
  processRecords: function(processRecordsInput, completeCallback) {
    if (!processRecordsInput || !processRecordsInput.records) {
      // Must call completeCallback to proceed further.
      completeCallback();
      return;
    }

    var records = processRecordsInput.records;
    var record, sequenceNumber, partitionKey, data;
    for (var i = 0 ; i < records.length ; ++i) {
      record = records[i];
      sequenceNumber = record.sequenceNumber;
      partitionKey = record.partitionKey;
      // Note that "data" is a base64-encoded string. Buffer can be used to
      // decode the data into a string.
      data = new Buffer(record.data, 'base64').toString();

      // Custom record processing logic ...
    }
    if (!sequenceNumber) {
      // Must call completeCallback to proceed further.
      completeCallback();
      return;
    }
    // If checkpointing, only call completeCallback once checkpoint operation
    // is complete.
    processRecordsInput.checkpointer.checkpoint(sequenceNumber,
      function(err, checkpointedSequenceNumber) {
        // In this example, regardless of error, we mark processRecords
        // complete to proceed further with more records.
        completeCallback();
      }
    );
  },

  /**
   * Called by KCL to indicate that this record processor should shut down.
   * After shutdown operation is complete, there will not be any more calls to
   * any other functions of this record processor. Note that reason
   * could be either TERMINATE or ZOMBIE. If ZOMBIE, clients should not
   * checkpoint because there is possibly another record processor which has
   * acquired the lease for this shard. If TERMINATE, then
   * `checkpointer.checkpoint()` should be called to checkpoint at the end of
   * the shard so that this processor will be shut down and new processors
   * will be created for the children of this shard.
   *
   * @param {object} shutdownInput - Shutdown information. Looks like -
   *             {"reason":"<TERMINATE|ZOMBIE>", "checkpointer":<Checkpointer>}
   * @param {Checkpointer} shutdownInput.checkpointer - A checkpointer which
   *             accepts a `string` or `null` sequence number and a callback.
   * @param {callback} completeCallback - The callback that must be invoked
   *             once shutdown-related operations are complete and checkpoint
   *             (optional) is complete.
   */
  shutdown: function(shutdownInput, completeCallback) {
    // Shutdown logic ...

    if (shutdownInput.reason !== 'TERMINATE') {
      completeCallback();
      return;
    }
    // Since you are checkpointing, only call completeCallback once the checkpoint
    // operation is complete.
    shutdownInput.checkpointer.checkpoint(function(err) {
      // In this example, regardless of error, we mark the shutdown operation
      // complete.
      completeCallback();
    });
  }
};

kcl(recordProcessor).run();
```

## Before You Get Started

### Prerequisite
Before you begin, Node.js and NPM must be installed on your system. For download instructions for your platform, see http://nodejs.org/download/.

To get the sample KCL application and bootstrap script, you need git.

Amazon KCL for Node.js uses [MultiLangDaemon][multi-lang-daemon] provided by [Amazon KCL for Java][amazon-kcl-github]. You also need Java version 1.7 or higher installed.

### Setting Up the Environment
Before running the samples, make sure that your environment is configured to allow the samples to use your [AWS Security Credentials](http://docs.aws.amazon.com/general/latest/gr/aws-security-credentials.html), which are used by [MultiLangDaemon][multi-lang-daemon] to interact with AWS services.

By default, the [MultiLangDaemon][multi-lang-daemon] uses the [DefaultAWSCredentialsProviderChain][DefaultAWSCredentialsProviderChain], so make your credentials available to one of the credentials providers in that provider chain. There are several ways to do this. You can provide credentials through a `~/.aws/credentials` file or through environment variables (**AWS\_ACCESS\_KEY\_ID** and **AWS\_SECRET\_ACCESS\_KEY**). If you're running on Amazon EC2, you can associate an IAM role with your instance with appropriate access.

For more information about [Amazon Kinesis][amazon-kinesis] and the client libraries, see the
[Amazon Kinesis documentation][amazon-kinesis-docs] as well as the [Amazon Kinesis forums][kinesis-forum].

## Running the Sample

The Amazon KCL for Node.js repository contains source code for the KCL, a sample data producer and data consumer (processor) application, and the bootstrap script.

To run sample applications, you need to get all required NPM modules. **From the root of the repository**, execute the following command:

`npm install`

This downloads all dependencies for running the bootstrap script as well as the sample application.

The sample application consists of two components:

* A data producer (`samples/basic_sample/producer/sample_kinesis_producer_app.js`): this script creates an [Amazon Kinesis][amazon-kinesis] stream and starts putting 10 random records into it.
* A data processor (`samples/basic_sample/consumer/sample_kcl_app.js`): this script is invoked by the [MultiLangDaemon][multi-lang-daemon], consumes the data from the [Amazon Kinesis][amazon-kinesis] stream, and stores received data into files (1 file per shard).

The following defaults are used in the sample application:

* *Stream name*: `kclnodejssample`
* *Number of shards*: 2
* *Amazon KCL application name*: `kclnodejssample`
* *Amazon DynamoDB table for Amazon KCL application*: `kclnodejssample`

### Running the Data Producer
To run the data producer, execute the following commands from the root of the repository:

```sh
    cd samples/basic_sample/producer
    node sample_kinesis_producer_app.js
```

#### Notes
* The script `samples/basic_sample/producer/sample_kinesis_producer_app.js` takes several parameters that you can use to customize its behavior. To change default parameters, change values in the file `samples/basic_sample/producer/config.js`.

### Running the Data Processor
To start the data processor, run the following command from the root of the repository:

```sh
    cd samples/basic_sample/consumer
    ../../../bin/kcl-bootstrap --java /usr/bin/java -e -p ./sample.properties
```

#### Notes
* The Amazon KCL for Node.js uses stdin/stdout to interact with [MultiLangDaemon][multi-lang-daemon]. Do not point your application logs to stdout/stderr. If your logs point to stdout/stderr, log output gets mingled with [MultiLangDaemon][multi-lang-daemon], which makes it really difficult to find consumer-specific log events. This consumer uses a logging library to redirect all application logs to a file called application.log. Make sure to follow a similar pattern while developing consumer applications with the Amazon KCL for Node.js. For more information about the protocol between the MultiLangDaemon and the Amazon KCL for Node.js, go to [MultiLangDaemon][multi-lang-daemon].
* The bootstrap script downloads [MultiLangDaemon][multi-lang-daemon] and its dependencies.
* The bootstrap script invokes the [MultiLangDaemon][multi-lang-daemon], which starts the Node.js consumer application as its child process. By default:
  * The file `samples/basic_sample/consumer/sample.properties` controls which Amazon KCL for Node.js application is run. You can specify your own properties file with the `-p` or `--properties` argument.
  * The bootstrap script uses `JAVA_HOME` to locate the java binary. To specify your own java home path, use the `-j` or `--java` argument when invoking the bootstrap script.
* To only print commands on the console to run the KCL application without actually running the KCL application, leave out the `-e` or `--execute` argument to the bootstrap script.
* You can also add REPOSITORY_ROOT/bin to your PATH so you can access kcl-bootstrap from anywhere.
* To find out all the options you can override when running the bootstrap script, run the following command:

```sh
    kcl-bootstrap --help
```

## Running the DynamoDB Stream Sample

The samples/ddb_stream_sample/consumer sample demonstrates using KCL to consume a DynamoDB stream.  It is essencially the same code
as the samples/basic_sample/consumer sample, except instead of a Kinesis stream, a DynamoDB stream is consumed and logged to a file.

To run this sample, you must first create a DynamoDB table in your account and enable streaming on that table.  When you do this, you will
be given an ARN for the stream, which you then need to put into samples/ddb_stream_sample/consumer/sample.properties as the "streamName".
You must do this before running the sample.

To run the sample, run the following command from the root of the repository:

```sh
    cd samples/ddb_stream_sample/consumer
    ../../../bin/kcl-bootstrap --java /usr/bin/java -e -p ./sample.properties -s
```

The addition of "-s" to the command line causes kcl-bootstrap to use the DynamoDB Stream adapter to interface the KCL to your
dynamodb stream.

With that command running, you can go into the aws console and write a couple of entries into your dynamodb table.  You should
see some activity being logged by the consumer.  You can see the dynamodb records being captured into application.log in the sample
directory.

### Cleaning Up
This sample application creates an [Amazon Kinesis][amazon-kinesis] stream, sends data to it, and creates a DynamoDB table to track the KCL application state. This will incur nominal costs to your AWS account, and continue to do so even when the sample app is finished. To stop being charged, delete these resources. Specifically, the sample application creates following AWS resources:

* An *Amazon Kinesis stream* named `kclnodejssample`
* An *Amazon DynamoDB table* named `kclnodejssample`

You can delete these using the AWS Management Console.

## Running on Amazon EC2
Log into an Amazon EC2 instance running Amazon Linux, then perform the following steps to prepare your environment for running the sample application. Note the version of Java that ships with Amazon Linux can be found at `/usr/bin/java` and should be 1.7 or greater.

```sh
    # install node.js, npm and git
    sudo yum install nodejs npm --enablerepo=epel
    sudo yum install git
    # clone the git repository to work with the samples
    git clone https://github.com/awslabs/amazon-kinesis-client-node.git kclnodejs
    cd kclnodejs/samples/basic_sample/producer/
    # download dependencies
    npm install
    # run the sample producer
    node sample_kinesis_producer_app.js &

    # ...and in another terminal, run the sample consumer
    export PATH=$PATH:kclnodejs/bin
    cd kclnodejs/samples/basic_sample/consumer/
    kcl-bootstrap --java /usr/bin/java -e -p ./sample.properties > consumer.out 2>&1 &
```

## NPM module
To get the Amazon KCL for Node.js module from NPM, use the following command:

```sh
  npm install aws-kcl
```

## Under the Hood: Supplemental information about the MultiLangDaemon

Amazon KCL for Node.js uses [Amazon KCL for Java][amazon-kcl-github] internally. We have implemented a Java-based daemon, called the *[MultiLangDaemon][multi-lang-daemon]* that does all the heavy lifting. The daemon launches the user-defined record processor script/program as a sub-process, and then communicates with this sub-process over standard input/output using a simple protocol. This allows support for any language. This approach enables the [Amazon KCL][amazon-kcl] to be language-agnostic, while providing identical features and similar parallel processing model across all languages.

At runtime, there will always be a one-to-one correspondence between a record processor, a child process, and an [Amazon Kinesis shard][amazon-kinesis-shard]. The [MultiLangDaemon][multi-lang-daemon] ensures that, without any developer intervention.

In this release, we have abstracted these implementation details away and exposed an interface that enables you to focus on writing record processing logic in Node.js.

## See Also

* [Developing Processor Applications for Amazon Kinesis Using the Amazon Kinesis Client Library][amazon-kcl]
* [Amazon KCL for Java][amazon-kcl-github]
* [Amazon KCL for Python][amazon-kinesis-python-github]
* [Amazon KCL for Ruby][amazon-kinesis-ruby-github]
* [Amazon Kinesis documentation][amazon-kinesis-docs]
* [Amazon Kinesis forum][kinesis-forum]


## Release Notes

### Release 0.5.0 (March 26, 2015)
* The `aws-kcl` npm module allows implementation of record processors in Node.js using the Amazon KCL [MultiLangDaemon][multi-lang-daemon].
* The `samples` directory contains a sample producer and processing applications using the Amazon KCL for Node.js.

[amazon-kinesis]: http://aws.amazon.com/kinesis
[amazon-kinesis-docs]: http://aws.amazon.com/documentation/kinesis/
[amazon-kinesis-shard]: http://docs.aws.amazon.com/kinesis/latest/dev/key-concepts.html
[amazon-kcl]: http://docs.aws.amazon.com/kinesis/latest/dev/kinesis-record-processor-app.html
[aws-sdk-node]: http://aws.amazon.com/sdk-for-node-js/
[amazon-kcl-github]: https://github.com/awslabs/amazon-kinesis-client
[amazon-kinesis-python-github]: https://github.com/awslabs/amazon-kinesis-client-python
[amazon-kinesis-ruby-github]: https://github.com/awslabs/amazon-kinesis-client-ruby
[multi-lang-daemon]: https://github.com/awslabs/amazon-kinesis-client/blob/master/src/main/java/com/amazonaws/services/kinesis/multilang/package-info.java
[DefaultAWSCredentialsProviderChain]: http://docs.aws.amazon.com/AWSJavaSDK/latest/javadoc/com/amazonaws/auth/DefaultAWSCredentialsProviderChain.html
[kinesis-forum]: http://developer.amazonwebservices.com/connect/forum.jspa?forumID=169
[aws-console]: http://aws.amazon.com/console/
[jvm]: http://java.com/en/download/
