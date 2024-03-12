/***
Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
***/

'use strict';


var chai = require('chai');
var expect = chai.expect;
var should = chai.should();
var sinon = require('sinon');
var util = require('util');

var IOHandler = require('../../lib/kcl/io_handler');
var ActionHandler = require('../../lib/kcl/action_handler');

// Local stub to capture stdout/stderr.
function captureStream(stream) {
  var origWrite = stream.write;
  var buffer = '';

  stream.write = function(chunk, encoding, callback) {
    buffer += chunk.toString();
    origWrite.apply(stream, arguments);
    return true;
  };

  return {
    unhook: function unhook() {
      stream.write = origWrite;
    },
    captured: function() {
      return buffer;
    },
    readLast: function() {
      var lines = buffer.split('\n');
      return lines[lines.length - 2];
    }
  };
}

describe('action_handler_tests', function() {
  var stdoutHook = null;
  var stderrHook = null;
  var ioHandler = new IOHandler(process.stdin, process.stdout, process.stderr);
  var actionHandler = new ActionHandler(ioHandler);

  beforeEach(function() {
    stdoutHook = captureStream(process.stdout);
    stderrHook = captureStream(process.stderr);
  });

  afterEach(function() {
    stdoutHook.unhook();
    stderrHook.unhook();
  });

  after(function() {
    actionHandler.destroy();
    ioHandler.destroy();
  });


  it('should not emit action for an invalid action', function(done) {
    ioHandler.emit('line', '{"shardId":"shardId-000001"}');
    expect(stderrHook.captured()).to.equal('Invalid action received: {"shardId":"shardId-000001"}\n');
    done();
  });

  it('should emit action event for a valid action', function(done) {
    actionHandler.on('action', function(action) {
      expect(action.action).to.equal('initialize');
      expect(action.shardId).to.equal('shardId-000001');
      done();
    });
    ioHandler.emit('line', '{"action":"initialize","shardId":"shardId-000001"}');
  });

  it('should write action to stdout', function(done) {
    actionHandler.sendAction({action : 'initialize', shardId : 'shardId-000001'}, function(err) {
      should.equal(err, null);
      expect(stdoutHook.readLast()).to.equal('{"action":"initialize","shardId":"shardId-000001"}');
      done();
    });
  });

  it('should emit end event when IO handler is closed', function(done) {
    actionHandler.on('end', function() {
      done();
    });
    ioHandler.emit('close');
  });
});
