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
      coverage: {
        options: {
          force: true
        },
        src: ['coverage']
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
          require: ['test/unit_tests_bootstrap'],
          clearRequireCache: true
        },
        src: ['test/**/*_tests.js']
      },
      html: mochaCoverageOptions('html-cov', 'coverage/index.html'),
      json: mochaCoverageOptions('json-cov', 'coverage/javascript.coverage.json'),
    },

    jsdoc : {
      dist : {
        src: ['index.js', 'lib/**/*.js', 'README.md'],
        jsdoc: './node_modules/grunt-jsdoc/node_modules/jsdoc/jsdoc',
        options: {
          destination: 'doc',
          configure: './conf/jsdoc.conf.json',
          template: './node_modules/grunt-jsdoc/node_modules/ink-docstrap/template'
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
