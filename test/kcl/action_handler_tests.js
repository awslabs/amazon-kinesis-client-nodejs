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
var expect = chai.expect;
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
      expect(err).to.be.undefined();
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
