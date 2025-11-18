#!/bin/bash
set -e

NUM_LEASES_FOUND=$(aws dynamodb scan --table-name $APP_NAME --select "COUNT" --query "Count" --output text || echo "0")
NUM_CHECKPOINTS_FOUND=$(aws dynamodb scan --table-name $APP_NAME --select "COUNT" --filter-expression "attribute_exists(checkpoint) AND checkpoint <> :trim_horizon" --expression-attribute-values '{":trim_horizon": {"S": "TRIM_HORIZON"}}' --query "Count" --output text || echo "0")

echo "Found $NUM_LEASES_FOUND leases and $NUM_CHECKPOINTS_FOUND non-TRIM-HORIZON checkpoints in DynamoDB"

echo "Printing checkpoint values"
aws dynamodb scan --table-name $APP_NAME --projection-expression "leaseKey,checkpoint" --output json

if [ "$NUM_LEASES_FOUND" -gt 0 ] && [ "$NUM_CHECKPOINTS_FOUND" -gt 0 ]; then
  echo "Test passed: Found both leases and non-TRIM_HORIZON checkpoints in DDB (KCL is fully functional)"
  exit 0
else
  echo "Test failed: KCL not fully functional"
  echo "Lease(s) found: $NUM_LEASES_FOUND"
  echo "non-TRIM_HORIZON checkpoint(s) found: $NUM_CHECKPOINTS_FOUND"
  exit 1
fi