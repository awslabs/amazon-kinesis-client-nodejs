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
  * Called by the KCL to indicate that this record processor should shut down.
  * After the lease lost operation is complete, there will not be any more calls to
  * any other functions of this record processor. Clients should not attempt to
  * checkpoint because the lease has been lost by this Worker.
  * 
  * @param {object} leaseLostInput - Lease lost information.
  * @param {callback} completeCallback - The callback must be invoked once lease
  *               lost operations are completed.
  */
  leaseLost: function(leaseLostInput, completeCallback) {
    // Lease lost logic ...
    completeCallback();
  },

  /**
  * Called by the KCL to indicate that this record processor should shutdown.
  * After the shard ended operation is complete, there will not be any more calls to
  * any other functions of this record processor. Clients are required to checkpoint
  * at this time. This indicates that the current record processor has finished
  * processing and new record processors for the children will be created.
  * 
  * @param {object} shardEndedInput - ShardEnded information. Looks like -
  *               {"checkpointer": <Checpointer>}
  * @param {callback} completeCallback - The callback must be invoked once shard
  *               ended operations are completed.
  */
  shardEnded: function(shardEndedInput, completeCallback) {
    // Shard end logic ...
    
    // Since you are checkpointing, only call completeCallback once the checkpoint
    // operation is complete.
    shardEndedInput.checkpointer.checkpoint(function(err) {
      // In this example, regardless of the error, we mark the shutdown operation
      // complete.
      completeCallback();
    });
    completeCallback();
  }
};

kcl(recordProcessor).run();
```

## Before You Get Started

### Prerequisite
Before you begin, Node.js and NPM must be installed on your system. For download instructions for your platform, see http://nodejs.org/download/.

To get the sample KCL application and bootstrap script, you need git.

Amazon KCL for Node.js uses [MultiLangDaemon][multi-lang-daemon] provided by [Amazon KCL for Java][amazon-kcl-github]. You also need Java version 1.8 or higher installed.

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

### Cleaning Up
This sample application creates an [Amazon Kinesis][amazon-kinesis] stream, sends data to it, and creates a DynamoDB table to track the KCL application state. This will incur nominal costs to your AWS account, and continue to do so even when the sample app is finished. To stop being charged, delete these resources. Specifically, the sample application creates following AWS resources:

* An *Amazon Kinesis stream* named `kclnodejssample`
* An *Amazon DynamoDB table* named `kclnodejssample`

You can delete these using the AWS Management Console.

## Running on Amazon EC2
Log into an Amazon EC2 instance running Amazon Linux, then perform the following steps to prepare your environment for running the sample application. Note the version of Java that ships with Amazon Linux can be found at `/usr/bin/java` and should be 1.8 or greater.

```sh
    # install node.js, npm and git
    sudo yum install nodejs npm --enablerepo=epel
    sudo yum install git
    # clone the git repository to work with the samples
    git clone https://github.com/awslabs/amazon-kinesis-client-nodejs.git kclnodejs
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
### Release 2.2.5 (February 29, 2024)
* [PR #309](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/309) Updated amazon-kinesis-client and amazon-kinesis-client multilang from 2.5.4 to 2.5.5 and updated awssdk.version to match amazon-kinesis-client from 2.19.2 to 2.20.43

### Release 2.2.4 (January 16, 2024)
* [PR #298](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/298) Added dependency on aws-sdk arns
* [PR #293](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/293) Updated logback-classic to 1.3.12

### Release 2.2.3 (December 18, 2023)
* [PR #291](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/291) Updated KCL and KCL multilang to the latest version 2.5.4
* [PR #284](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/284) Updated netty to 4.1.100.Final, fasterxml-jackson to 2.13.5, and guava to 32.1.1-jre
* [PR #277](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/277) Updated com.google.protobuf:protobuf-java from 3.21.5 to 3.21.7

### Release 2.2.2 (January 4, 2023)
* [PR #207](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/207) Add endpoints-spi dependency

### Release 2.2.1 (January 3, 2023)
* [PR #202](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/202) Keep Java dependencies in sync with the KCL V2.4.4
  * Updated dependencies to match the v2.4.4 KCL Java release
  * Updated slfj to resolve the logger's incompatibility problem 

### Release 2.2.0 (September 15, 2022)
* [PR #165](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/165) Update Java dependencies  
  * KCL and KCL-multilang are updated to the latest version 2.4.3

### Release 2.1.0 (January 31, 2020)
[Milestone #4](https://github.com/awslabs/amazon-kinesis-client-nodejs/milestone/4)
* Fixing bootstrap to use HTTPS
  * [PR #75](https://github.com/awslabs/amazon-kinesis-client/pull/679)
* Adding support for Win32 platform
  * [PR #67](https://github.com/awslabs/amazon-kinesis-client/pull/668)
* Relicensing to Apache-2.0
  * [PR #69](https://github.com/awslabs/amazon-kinesis-client/pull/667)

### Release 2.0.0 (March 6, 2019)
* Added support for [Enhanced Fan-Out](https://aws.amazon.com/blogs/aws/kds-enhanced-fanout/).  
  Enhanced Fan-Out provides dedicated throughput per stream consumer, and uses an HTTP/2 push API (SubscribeToShard) to deliver records with lower latency.
* Updated the Amazon Kinesis Client Library for Java to version 2.1.2.
  * Version 2.1.2 uses 4 additional Kinesis API's  
    __WARNING: These additional API's may require updating any explicit IAM policies__
    * [`RegisterStreamConsumer`](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_RegisterStreamConsumer.html)
    * [`SubscribeToShard`](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_SubscribeToShard.html)
    * [`DescribeStreamConsumer`](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_DescribeStreamConsumer.html)
    * [`DescribeStreamSummary`](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_DescribeStreamSummary.html)
  * For more information about Enhanced Fan-Out with the Amazon Kinesis Client Library please see the [announcement](https://aws.amazon.com/blogs/aws/kds-enhanced-fanout/) and [developer documentation](https://docs.aws.amazon.com/streams/latest/dev/introduction-to-enhanced-consumers.html).
* Added support for the newer methods to the [`KCLManager`](https://github.com/awslabs/amazon-kinesis-client-nodejs/blob/a2be81a3bd4ccca7f68b616ebc416192c3be9d0e/lib/kcl/kcl_manager.js).  
  While the original `shutdown` method will continue to work it's recommended to upgrade to the newer interface.
  * The `shutdown` has been replaced by `leaseLost` and `shardEnded`.
  * Added the `leaseLost` method which is invoked when a lease is lost.  
    `leaseLost` replaces `shutdown` where `shutdownInput.reason` was `ZOMBIE`.
  * Added the `shardEnded` method which is invoked when all records from a split or merge have been processed.  
    `shardEnded`  replaces `shutdown` where `shutdownInput.reason` was `TERMINATE`.
* Updated the AWS Java SDK version to 2.4.0
* MultiLangDaemon now provides logging using Logback.
  * MultiLangDaemon supports custom configurations for logging via a Logback XML configuration file.
  * The `kcl-bootstrap` program was been updated to accept either `-l` or `--log-configuration` to provide a Logback XML configuration file.

### Release 0.8.0 (February 12, 2019)
* Updated the dependency on [Amazon Kinesis Client for Java][amazon-kcl-github] to 1.9.3
  * This adds support for ListShards API. This API is used in place of DescribeStream API to provide more throughput during ShardSyncTask. Please consult the [AWS Documentation for ListShards](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_ListShards.html) for more information.
    * ListShards supports higher call rate, which should reduce instances of throttling when attempting to synchronize the shard list.
    * __WARNING: `ListShards` is a new API, and may require updating any explicit IAM policies__
  * [PR #59](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/59)
* Changed to now download jars from Maven using `https`.
  * [PR #59](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/59)

### Release 0.7.0 (August 2, 2017)
* Updated the dependency on [Amazon Kinesis Client for Java][amazon-kcl-github] to 1.8.1.  
This adds support for setting a timeout when dispatching records to the node.js record processor.
If the record processor doesn't respond in the given time the Java processor is terminated.
The timeout for the this can be set by adding `timeoutInSeconds = <timeout value>`. The default for this is no timeout.  
__Setting this can cause the KCL to exit suddenly, before using this ensure that you have an automated restart for your application__  
__Updating minimum requirement for the JDK version to 8__
  * [Amazon Kinesis Client Issue #185](https://github.com/awslabs/amazon-kinesis-client/issues/185)
  * [PR #41](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/41)
* Added support to handle graceful shutdown requests.
  * [PR #39](https://github.com/awslabs/amazon-kinesis-client-nodejs/pull/39)
  * [Issue #34](https://github.com/awslabs/amazon-kinesis-client-nodejs/issues/34)

### Release 0.6.0 (December 12, 2016)
* Updated the dependency on [Amazon Kinesis Client for Java][amazon-kcl-github] to 1.7.2.
  * PR #23
  * PR #24

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

## License

This library is licensed under the Apache 2.0 License.
