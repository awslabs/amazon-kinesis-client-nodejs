#!/bin/bash
set -e

# Copy template files to working locations
cp .github/resources/sample.properties samples/basic_sample/consumer/sample.properties
cp .github/resources/config.js samples/basic_sample/producer/config.js

# Manipulate sample.properties file that the KCL application pulls properties from (ex: streamName, applicationName)
# Depending on the OS, different properties need to be changed
if [[ "$RUNNER_OS" == "macOS" ]]; then
  sed -i "" "s/streamName = .*/streamName = $STREAM_NAME/" samples/basic_sample/consumer/sample.properties
  sed -i "" "s/applicationName = .*/applicationName = $APP_NAME/" samples/basic_sample/consumer/sample.properties
  sed -i "" "s/stream : 'kclnodejssample'/stream : '$STREAM_NAME'/" samples/basic_sample/producer/config.js
elif [[ "$RUNNER_OS" == "Linux" || "$RUNNER_OS" == "Windows" ]]; then
  sed -i "s/streamName = .*/streamName = $STREAM_NAME/" samples/basic_sample/consumer/sample.properties
  sed -i "s/applicationName = .*/applicationName = $APP_NAME/" samples/basic_sample/consumer/sample.properties
  sed -i "s/stream : 'kclnodejssample'/stream : '$STREAM_NAME'/" samples/basic_sample/producer/config.js
else
  echo "Unknown OS: $RUNNER_OS"
  exit 1
fi

cat samples/basic_sample/consumer/sample.properties
cat samples/basic_sample/producer/config.js