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


var chai = require('chai');
var expect = require('chai').expect;
var sinon = require('sinon');
var util = require('util');

var Checkpointer = require('../../lib/kcl/checkpointer');
var KCLManager = require('../../lib/kcl/kcl_manager');

describe('checkpointer_tests', function() {
  var sandbox = null;
  var kclManager = new KCLManager(null, process.stdin, process.stdout, process.stderr);
  var checkpointer = new Checkpointer(kclManager);

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  after(function() {
    kclManager._cleanup();
  });

  it('should emit a checkpoint action and consume response action', function(done) {
    var seq = Math.floor((Math.random() * 1000000)).toString();
    // Mock KCLManager checkpoint and short-circuit dummy response.
    sandbox.stub(kclManager, 'checkpoint', function(seq) {
      checkpointer.onCheckpointerResponse(null, seq);
    });

    checkpointer.checkpoint(seq, function(err, seq) {
      expect(err).to.be.null();
      done();
    });
  });

  it('should emit a checkpoint action and consume response when no sequence number', function(done) {
    sandbox.stub(kclManager, 'checkpoint', function(seq) {
      expect(seq).to.be.null();
      checkpointer.onCheckpointerResponse(null, seq);
    });

    checkpointer.checkpoint(function(err) {
      expect(err).to.be.null();
      done();
    });
  });

  it('should raise an error when error is received from MultiLangDaemon', function(done) {
    var seq = Math.floor((Math.random() * 1000000)).toString();
    // Mock KCLManager checkpoint and short-circuit dummy response.
    sandbox.stub(kclManager, 'checkpoint', function(seq) {
      checkpointer.onCheckpointerResponse('ThrottlingException', seq);
    });

    checkpointer.checkpoint(seq, function(err) {
      expect(err).not.to.be.null();
      expect(err).to.equal('ThrottlingException');
      done();
    });
  });

  it('should raise an error on checkpoint when previous checkpoint is not complete', function(done) {
    var seq = Math.floor((Math.random() * 1000000)).toString();
    // Mock KCLManager checkpoint to have outstanding checkpoint.
    sandbox.stub(kclManager, 'checkpoint', function(seq) {
    });
    checkpointer.checkpoint(seq, function(err) {
    });

    checkpointer.checkpoint(seq, function(err) {
      expect(err).to.equal('Cannot checkpoint while another checkpoint is already in progress.');
      done();
    });
  });
});
