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


function clickStreamGenerator(totalResources) {
  var referrers = [
    'http://www.amazon.com',
    'http://www.google.com',
    'http://www.yahoo.com',
    'http://bing/com',
    'http://stackoverflow.com',
    'http://reddit.com'
  ];
  var resources = [];

  // List of resources and referrers to generate fake data. Resource names will also be used as partition-keys.
  for (var i = 0 ; i < totalResources ; i++) {
    resources.push('resource-' + i);
  }

  return {
    getRandomClickStreamData: function() {
      var referrer = referrers[Math.floor(Math.random() * referrers.length)];
      var resource = resources[Math.floor(Math.random() * resources.length)];

      var data = {
        resource: resource,
        referrer: referrer
      };

      return data;
    }
  };
}

module.exports = clickStreamGenerator;
