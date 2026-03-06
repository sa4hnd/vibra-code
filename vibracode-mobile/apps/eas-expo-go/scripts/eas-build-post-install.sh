#!/usr/bin/env bash

set -xeuo pipefail

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../../.. && pwd )"
export PATH="$ROOT_DIR/bin:$PATH"

if [ -n "${EXPO_TOKEN+x}" ]; then
  echo "Unsetting EXPO_TOKEN"
  unset EXPO_TOKEN
else
  echo "EXPO_TOKEN is not set"
fi

# Only run this if the VERIFY_VERSIONS_ENDPOINT is set
if [ -n "${VERIFY_VERSIONS_ENDPOINT+x}" ] && [ "${VERIFY_VERSIONS_ENDPOINT}" = "1" ]; then
  # Bail out if the versions endpoint is not available
  et eas verify-versions-endpoint-available
fi

if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  # Start Metro in background to serve our JavaScript code
  echo "Starting Metro server for JavaScript bundle generation..."
  cd $ROOT_DIR/apps/expo-go
  nohup yarn start --port 80 > metro.log 2>&1 &
  METRO_PID=$!
  
  # Wait for Metro to start
  sleep 30
  
  # Generate dynamic macros (this will now fetch from our Metro server)
  et ios-generate-dynamic-macros
  
  # Stop Metro
  kill $METRO_PID || true
  
  cd $ROOT_DIR/apps/eas-expo-go
fi


if [ "$EAS_BUILD_PROFILE" = "versioned-client-add-sdk" ]; then
  if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
    pushd ios
    bundle install
    popd
  fi
  et add-sdk --platform $EAS_BUILD_PLATFORM
fi
