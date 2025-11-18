#!/bin/bash

aws kinesis delete-stream --stream-name $STREAM_NAME || true

# Delete all tables
for i in {1..10}; do
  echo "Deleting table $APP_NAME"
  aws dynamodb delete-table --table-name $APP_NAME && break ||
  echo "Table deletion failed, attempt $i/10. Retrying DynamoDB Table deletion in $((i * 3)) seconds" && sleep $((i * 3))
done
for SUFFIX in "-CoordinatorState" "-WorkerMetricStats"; do
  if aws dynamodb describe-table --table-name $APP_NAME$SUFFIX &>/dev/null; then
    echo "Deleting table $APP_NAME$SUFFIX"
    for i in {1..10}; do
      aws dynamodb delete-table --table-name $APP_NAME$SUFFIX && break ||
      echo "Table deletion failed, attempt $i/10. Retrying DynamoDB Table deletion in $((i * 3))s" && sleep $((i * 3))
    done
  fi
done