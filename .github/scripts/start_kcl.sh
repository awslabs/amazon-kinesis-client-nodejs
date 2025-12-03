#!/bin/bash
set -e
set -o pipefail

if [[ "$RUNNER_OS" == "macOS" ]]; then
  brew install coreutils
  cd samples/basic_sample/consumer
  KCL_COMMAND="../../../bin/kcl-bootstrap --java /usr/bin/java -e -p ./sample.properties"
  gtimeout $RUN_TIME_SECONDS $KCL_COMMAND 2>&1 | tee kcl_output.log  || [ $? -eq 124 ]
elif [[ "$RUNNER_OS" == "Linux" || "$RUNNER_OS" == "Windows" ]]; then
  cd samples/basic_sample/consumer
  KCL_COMMAND="../../../bin/kcl-bootstrap -e -p ./sample.properties"
  timeout $RUN_TIME_SECONDS $KCL_COMMAND 2>&1 | tee kcl_output.log || [ $? -eq 124 ]
else
  echo "Unknown OS: $RUNNER_OS"
  exit 1
fi

echo "---------ERROR LOGS HERE-------"
grep -i error kcl_output.log || echo "No errors found in logs"