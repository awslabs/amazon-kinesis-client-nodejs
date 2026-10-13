/***
SPDX-License-Identifier: Apache-2.0
***/

'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var Command = require('commander').Command;

describe('bootstrap_tests', function() {
  var child;
  var parent;
  var spawn;

  beforeEach(function() {
    child = new EventEmitter();
    child.kill = sinon.stub().returns(true);
    parent = new EventEmitter();
    parent.argv = ['node', 'kcl-bootstrap', '-p', '/tmp/application.properties',
      '-j', '/usr/bin/java', '-c', '/tmp/jars', '-e'];
    parent.env = {};
    parent.platform = 'linux';
    parent.nextTick = function(callback) { callback(); };
    parent.exit = sinon.stub();
    spawn = sinon.stub().returns(child);

    var filename = path.resolve(__dirname, '../../bin/kcl-bootstrap');
    var fakeFs = {
      readFileSync: fs.readFileSync,
      existsSync: function() { return true; },
      readdirSync: function() { return []; },
      statSync: function() {
        return { isFile: function() { return true; }, isDirectory: function() { return true; } };
      }
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      __dirname: path.dirname(filename),
      process: parent,
      console: { log: function() {}, error: function() {} },
      require: function(name) {
        if (name === 'fs') { return fakeFs; }
        if (name === 'child_process') { return { spawn: spawn }; }
        if (name === 'commander') { return { program: new Command() }; }
        return require(name);
      }
    }, { filename: filename });
  });

  ['SIGTERM', 'SIGINT'].forEach(function(signal) {
    it('should forward ' + signal + ' only to Java and wait for it to exit', function() {
      parent.emit(signal);

      expect(spawn.calledOnce).to.equal(true);
      expect(spawn.firstCall.args[0]).to.equal('/usr/bin/java');
      expect(child.kill.calledOnceWithExactly(signal)).to.equal(true);
      expect(parent.exit.called).to.equal(false);

      child.emit('exit', 0, null);

      expect(parent.exit.calledOnceWithExactly(0)).to.equal(true);
      expect(parent.listenerCount('SIGTERM')).to.equal(0);
      expect(parent.listenerCount('SIGINT')).to.equal(0);
    });
  });

  [0, 23].forEach(function(code) {
    it('should preserve Java exit code ' + code, function() {
      child.emit('exit', code, null);
      expect(parent.exit.calledOnceWithExactly(code)).to.equal(true);
    });
  });

  ['SIGTERM', 'SIGINT'].forEach(function(signal) {
    it('should preserve Java termination by ' + signal, function() {
      child.emit('exit', null, signal);
      expect(parent.exit.calledOnceWithExactly(128 + require('os').constants.signals[signal])).to.equal(true);
    });
  });

  it('should fail cleanly and remove signal handlers if Java cannot start', function() {
    child.emit('error', new Error('spawn failed'));
    expect(parent.exit.calledOnceWithExactly(1)).to.equal(true);
    expect(parent.listenerCount('SIGTERM')).to.equal(0);
    expect(parent.listenerCount('SIGINT')).to.equal(0);
  });
});
