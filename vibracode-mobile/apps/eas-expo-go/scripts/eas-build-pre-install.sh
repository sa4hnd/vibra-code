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

if [ "$EAS_BUILD_PLATFORM" = "android" ]; then
  sudo apt-get -y update
  sudo apt-get -y install ruby icu-devtools libicu-dev maven
  sdkmanager "cmdline-tools;latest"
  sdkmanager "cmake;3.30.5"
elif [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  HOMEBREW_NO_AUTO_UPDATE=1 brew install cmake
  # Ensure CocoaPods master repo is set up (Git-based, more reliable than CDN)
  echo "Checking CocoaPods master repo..."
  if ! pod repo list | grep -q "master"; then
    echo "Adding CocoaPods master repo (Git-based)..."
    pod repo add master https://github.com/CocoaPods/Specs.git 2>&1 || {
      echo "Failed to add master repo, repo may already exist..."
    }
  fi
  echo "Updating CocoaPods master repo..."
  pod repo update master 2>&1 || true
fi

if [ "$EAS_BUILD_PROFILE" = "release-client" ] || [ "$EAS_BUILD_PROFILE" = "publish-client" ]; then
  if [ "$EAS_BUILD_PLATFORM" = "android" ]; then
    sudo apt-get -y update
    sudo apt-get -y install git-crypt
  elif [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
    HOMEBREW_NO_AUTO_UPDATE=1 brew install git-crypt
  fi
  
  # Only unlock git-crypt if the key is available
  if [ -n "${GIT_CRYPT_KEY:-}" ]; then
    git-crypt unlock $GIT_CRYPT_KEY
  else
    echo "GIT_CRYPT_KEY not available, skipping git-crypt unlock (this is normal for non-Expo team builds)"
  fi
fi

cat << EOF > $ROOT_DIR/.gitmodules
[submodule "react-native-lab/react-native"]
  path = react-native-lab/react-native
  url = https://github.com/expo/react-native.git
  branch = exp-latest
  update = checkout
EOF

git submodule update --init

# Apply custom patches to react-native submodule
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PATCHES_DIR="$SCRIPT_DIR/../patches"
if [ -d "$PATCHES_DIR" ]; then
  echo "Applying custom patches..."
  for patch in "$PATCHES_DIR"/*.patch; do
    if [ -f "$patch" ]; then
      echo "Applying patch: $patch"
      git -C "$ROOT_DIR/react-native-lab/react-native" apply "$patch" || echo "Patch may have already been applied: $patch"
    fi
  done
fi

if [ -n "${EAS_BUILD_NPM_CACHE_URL-}" ]; then
  sed -i -e "s#https://registry.yarnpkg.com#$EAS_BUILD_NPM_CACHE_URL#g" $ROOT_DIR/yarn.lock || true
fi

pushd $ROOT_DIR/tools
yarn

if [ "$EAS_BUILD_PROFILE" = "release-client" ] && [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  et eas remove-background-permissions-from-info-plist
fi
