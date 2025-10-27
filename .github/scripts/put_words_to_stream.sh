#!/bin/bash
set -e

cd samples/basic_sample/producer
node sample_kinesis_producer_app.js

# Get records from stream to verify they exist before continuing
SHARD_ITERATOR=$(aws kinesis get-shard-iterator --stream-name $STREAM_NAME --shard-id shardId-000000000000 --shard-iterator-type TRIM_HORIZON --query 'ShardIterator' --output text)
INITIAL_RECORDS=$(aws kinesis get-records --shard-iterator $SHARD_ITERATOR)
RECORD_COUNT_BEFORE=$(echo $INITIAL_RECORDS | jq '.Records | length')

if [ "$RECORD_COUNT_BEFORE" -eq 0 ]; then
  echo "No records found in stream. Test cannot proceed."
  exit 1
fi
echo "Found $RECORD_COUNT_BEFORE records in stream before KCL start"