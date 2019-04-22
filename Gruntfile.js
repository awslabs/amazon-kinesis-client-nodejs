/***
 Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 SPDX-License-Identifier: Apache-2.0
 ***/

'use strict';


function mochaCoverageOptions(reporterName, outFile) {
  return {
    options: {
      reporter: reporterName,
      quiet: true,
      captureFile: outFile
    },
    src: ['test/**/*_tests.js']
  };
}

module.exports = function(grunt) {

  grunt.initConfig({

    jshint: {
      options: {
        jshintrc: 'conf/.jshintrc'
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      bin: {
        src: ['bin/kcl-bootstrap']
      },
      lib: {
        src: ['index.js', 'lib/**/*.js']
      },
      test: {
        src: ['test/**/*.js']
      },
      samples: {
        src: ['samples/**/*.js']
      }
    },

    clean: {
      build: {
        options: {
          force: true
        },
        src: ['build']
      },
      doc: {
        options: {
          force: true
        },
        src: ['doc']
      }
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          clearRequireCache: true,
        },
        src: ['test/**/*_tests.js']
      }
    },

    jsdoc: {
      dist: {
        src: ['index.js', 'lib/**/*.js', 'README.md'],
        jsdoc: 'node_modules/grunt-jsdoc/node_modules/jsdoc/jsdoc',
        options: {
          destination: 'doc',
          configure: 'conf/jsdoc.conf.json',
          template: 'node_modules/ink-docstrap/template'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('default', ['jshint', 'mochaTest']);
  grunt.registerTask('build', 'compile');
  grunt.registerTask('compile', ['jshint']);
  // clean task already defined above.
  grunt.registerTask('doc', 'jsdoc');
  grunt.registerTask('test', ['jshint', 'mochaTest']);
  grunt.registerTask('release', ['jshint', 'mochaTest', 'jsdoc']);
};
