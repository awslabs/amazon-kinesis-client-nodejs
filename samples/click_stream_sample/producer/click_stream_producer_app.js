/***
Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
***/

'use strict';


var AWS = require('aws-sdk');
var config = require('./config');
var producer = require('./click_stream_producer');

var kinesis = new AWS.Kinesis({region: config.kinesis.region});
producer(kinesis, config.clickStreamProducer).run();
