/***
Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
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
  var kclManager = new KCLManager({}, process.stdin, process.stdout, process.stderr);
  var checkpointer = new Checkpointer(kclManager);

  before(function() {
    kclManager.run();
  });

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
