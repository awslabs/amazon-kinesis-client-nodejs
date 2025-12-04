#!/bin/bash
set -e

# Copy template files to working locations
cp .github/resources/github_workflow.properties samples/basic_sample/consumer/github_workflow.properties
cp .github/resources/config.js samples/basic_sample/producer/config.js

# Manipulate github_workflow.properties file that the KCL application pulls properties from (ex: streamName, applicationName)
# Depending on the OS, different properties need to be changed
if [[ "$RUNNER_OS" == "macOS" ]]; then
  sed -i "" "s/STREAM_NAME_PLACEHOLDER/$STREAM_NAME/g" samples/basic_sample/consumer/github_workflow.properties
  sed -i "" "s/APP_NAME_PLACEHOLDER/$APP_NAME/g" samples/basic_sample/consumer/github_workflow.properties
elif [[ "$RUNNER_OS" == "Linux" || "$RUNNER_OS" == "Windows" ]]; then
  sed -i "s/STREAM_NAME_PLACEHOLDER/$STREAM_NAME/g" samples/basic_sample/consumer/github_workflow.properties
  sed -i "s/APP_NAME_PLACEHOLDER/$APP_NAME/g" samples/basic_sample/consumer/github_workflow.properties
else
  echo "Unknown OS: $RUNNER_OS"
  exit 1
fi

cat samples/basic_sample/consumer/github_workflow.properties
cat samples/basic_sample/producer/config.js