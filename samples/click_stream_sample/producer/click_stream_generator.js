/***
Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
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
