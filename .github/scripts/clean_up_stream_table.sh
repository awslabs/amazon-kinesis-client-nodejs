#!/bin/bash

# Delete stream
if aws kinesis describe-stream --stream-name $STREAM_NAME &>/dev/null; then
  echo "Deleting stream $STREAM_NAME"
  for i in {1..10}; do
    aws kinesis delete-stream --stream-name $STREAM_NAME && break ||
    echo "Stream deletion failed, attempt $i/10. Retrying Stream deletion in $((i * 3))s" && sleep $((i * 3))
  done
else
  echo "Stream $STREAM_NAME does not exist and does not need to be cleaned up"
fi

# Delete table
delete_table() {
  table_name=$1
  if aws dynamodb describe-table --table-name $table_name &>/dev/null; then
    echo "Deleting table $table_name"
    for i in {1..10}; do
      aws dynamodb delete-table --table-name $table_name && break ||
      echo "Table deletion failed, attempt $i/10. Retrying DynamoDB Table deletion in $((i * 3))s" && sleep $((i * 3))
    done
  else
    echo "Table $table_name does not exist and does not need to be cleaned up"
  fi
}

# Delete all tables
for SUFFIX in "" "-CoordinatorState" "-WorkerMetricStats"; do
  delete_table "$APP_NAME$SUFFIX"
done