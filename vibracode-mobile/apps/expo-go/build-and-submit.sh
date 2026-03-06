#!/bin/bash

# Vibra Code - Automated Build and Submit Script
# This script builds and submits the iOS app to the App Store

set -e  # Exit on first error

# Configuration - Update these paths for your environment
EXPO_PUSH_TOKEN=""  # Set your Expo push token
MACROS_FILE="../../tools/src/dynamic-macros/macros.ts"
EAS_EXPO_GO_DIR="../../apps/eas-expo-go"
EXPO_REPO_DIR="../../"
V0_CLONE_DIR="../../v0-clone"
BACKUP_FILE="/tmp/macros.ts.backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to send push notification
send_notification() {
    local title="$1"
    local body="$2"

    echo -e "${YELLOW}Sending push notification...${NC}"

    curl -s -X POST https://exp.host/--/api/v2/push/send \
        -H "Content-Type: application/json" \
        -d "{
            \"to\": \"$EXPO_PUSH_TOKEN\",
            \"title\": \"$title\",
            \"body\": \"$body\",
            \"sound\": \"default\"
        }" > /dev/null 2>&1

    echo -e "${GREEN}Notification sent!${NC}"
}

# Function to restore macros.ts
restore_macros() {
    echo -e "${YELLOW}Restoring macros.ts to original...${NC}"
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$MACROS_FILE"
        rm "$BACKUP_FILE"
        echo -e "${GREEN}macros.ts restored successfully!${NC}"
    else
        echo -e "${RED}Warning: Backup file not found, macros.ts not restored${NC}"
    fi
}

# Function to handle errors
handle_error() {
    local step="$1"
    echo -e "${RED}Error during: $step${NC}"
    send_notification "❌ Build Failed" "Vibra Code build failed during: $step"
    restore_macros
    exit 1
}

# Trap to ensure cleanup on script exit
trap 'if [ $? -ne 0 ]; then restore_macros; fi' EXIT

echo "========================================"
echo "  Vibra Code - Build & Submit Script"
echo "========================================"
echo ""

# Step 1: Push expo repo to GitHub
echo -e "${YELLOW}Step 1: Pushing expo repo to GitHub...${NC}"
cd "$EXPO_REPO_DIR"
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "Pre-release build commit"
    git push origin main
    echo -e "${GREEN}Expo repo pushed to GitHub!${NC}"
else
    echo -e "${GREEN}Expo repo is clean, no changes to push${NC}"
fi
echo ""

# Step 2: Push v0-clone to GitHub
echo -e "${YELLOW}Step 2: Pushing v0-clone to GitHub...${NC}"
cd "$V0_CLONE_DIR"
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "Pre-release build commit"
    git push origin main
    echo -e "${GREEN}v0-clone pushed to GitHub!${NC}"
else
    echo -e "${GREEN}v0-clone is clean, no changes to push${NC}"
fi
echo ""

# Step 3: Backup current macros.ts
echo -e "${YELLOW}Step 3: Backing up macros.ts...${NC}"
cp "$MACROS_FILE" "$BACKUP_FILE"
echo -e "${GREEN}Backup created at $BACKUP_FILE${NC}"
echo ""

# Step 4: Update macros.ts with release version
echo -e "${YELLOW}Step 4: Updating macros.ts for release build...${NC}"
cat > "$MACROS_FILE" << 'MACROS_EOF'
import JsonFile from '@expo/json-file';
import {
  isMultipartPartWithName,
  parseMultipartMixedResponseAsync,
} from '@expo/multipart-body-parser';
import spawnAsync from '@expo/spawn-async';
import chalk from 'chalk';
import crypto from 'crypto';
import { lanNetwork } from 'lan-network';
import os from 'os';
import path from 'path';

import { EXPO_GO_DIR, EXPO_GO_DEV_SERVER_PORT } from '../Constants';
import { getExpoRepositoryRootDir } from '../Directories';
import { getExpoGoSDKVersionAsync } from '../ProjectVersions';

interface Manifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  metadata: { [key: string]: string };
  extra: {
    eas: {
      projectId: string;
    };
    expoClient?: {
      name: string;
    };
  };
}

// some files are absent on turtle builders and we don't want log errors there
const isTurtle = !!process.env.TURTLE_WORKING_DIR_PATH;

type AssetRequestHeaders = { authorization: string };

async function getManifestBodyAsync(response: Response): Promise<{
  manifest: Manifest;
  assetRequestHeaders: {
    [assetKey: string]: AssetRequestHeaders;
  };
}> {
  const contentType = response.headers.get('content-type');
  if (!contentType) {
    throw new Error('The multipart manifest response is missing the content-type header');
  }

  if (contentType === 'application/expo+json' || contentType === 'application/json') {
    const text = await response.text();
    return { manifest: JSON.parse(text), assetRequestHeaders: {} };
  }

  const bodyBuffer = await response.arrayBuffer();
  const multipartParts = await parseMultipartMixedResponseAsync(
    contentType,
    Buffer.from(bodyBuffer)
  );

  const manifestPart = multipartParts.find((part) => isMultipartPartWithName(part, 'manifest'));
  if (!manifestPart) {
    throw new Error('The multipart manifest response is missing the manifest part');
  }

  const extensionsPart = multipartParts.find((part) => isMultipartPartWithName(part, 'extensions'));
  const assetRequestHeaders = extensionsPart
    ? JSON.parse(extensionsPart.body).assetRequestHeaders
    : {};

  return { manifest: JSON.parse(manifestPart.body), assetRequestHeaders };
}

async function getManifestAsync(
  url: string,
  platform: string
): Promise<{
  manifest: Manifest;
  assetRequestHeaders: {
    [assetKey: string]: AssetRequestHeaders;
  };
}> {
  const response = await fetch(url.replace('exp://', 'http://').replace('exps://', 'https://'), {
    method: 'GET',
    headers: {
      accept: 'multipart/mixed,application/expo+json,application/json',
      'expo-platform': platform,
    },
  });
  return await getManifestBodyAsync(response);
}

async function getSavedDevHomeEASUpdateUrlAsync(): Promise<string> {
  const devHomeConfig = await new JsonFile(
    path.join(getExpoRepositoryRootDir(), 'dev-home-config.json')
  ).readAsync();
  return devHomeConfig.url as string;
}

function kernelManifestAndAssetRequestHeadersObjectToJson(obj: {
  manifest: Manifest;
  assetRequestHeaders: {
    [assetKey: string]: AssetRequestHeaders;
  };
}) {
  return JSON.stringify(obj);
}

export default {
  async TEST_APP_URI() {
    if (process.env.TEST_SUITE_URI) {
      return process.env.TEST_SUITE_URI;
    }
    return '';
  },

  async TEST_CONFIG() {
    if (process.env.TEST_CONFIG) {
      return process.env.TEST_CONFIG;
    } else {
      return '';
    }
  },

  async TEST_SERVER_URL() {
    return 'TODO';
  },

  async TEST_RUN_ID() {
    return process.env.UNIVERSE_BUILD_ID || crypto.randomUUID();
  },

  async BUILD_MACHINE_LOCAL_HOSTNAME() {
    if (process.env.SHELL_APP_BUILDER) {
      return '';
    }

    try {
      const result = await spawnAsync('scutil', ['--get', 'LocalHostName']);
      return `${result.stdout.trim()}.local`;
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error(e.stack);
      }
      return os.hostname();
    }
  },

  async DEV_PUBLISHED_KERNEL_MANIFEST(platform) {
    let manifestAndAssetRequestHeaders: {
      manifest: Manifest;
      assetRequestHeaders: {
        [assetKey: string]: AssetRequestHeaders;
      };
    };
    let savedDevHomeUrl: string | undefined;
    try {
      savedDevHomeUrl = await getSavedDevHomeEASUpdateUrlAsync();
      manifestAndAssetRequestHeaders = await getManifestAsync(savedDevHomeUrl, platform);
    } catch (e) {
      const msg = `Unable to download manifest from ${savedDevHomeUrl ?? '(error)'}: ${e.message}`;
      console[isTurtle ? 'debug' : 'error'](msg);
      return '';
    }

    return kernelManifestAndAssetRequestHeadersObjectToJson(manifestAndAssetRequestHeaders);
  },

  async BUILD_MACHINE_KERNEL_MANIFEST(platform) {
    if (process.env.SHELL_APP_BUILDER) {
      return '';
    }

    // For EAS Update approach, always return empty string to use remote updates
    console.log('Using EAS Update approach - no embedded kernel manifest needed');
    return '';
  },

  async TEMPORARY_SDK_VERSION(): Promise<string> {
    return await getExpoGoSDKVersionAsync();
  },
};
MACROS_EOF
echo -e "${GREEN}macros.ts updated for release build${NC}"
echo ""

# Step 5: Commit the macros.ts change to make git clean
echo -e "${YELLOW}Step 5: Committing macros.ts change...${NC}"
cd "$EXPO_REPO_DIR"
git add "$MACROS_FILE"
git commit -m "Temporary: Update macros.ts for release build"
echo -e "${GREEN}macros.ts change committed${NC}"
echo ""

# Step 6: Navigate to eas-expo-go and run EAS Build
echo -e "${YELLOW}Step 6: Starting EAS Build (this may take 20-40 minutes)...${NC}"
cd "$EAS_EXPO_GO_DIR"
echo -e "${GREEN}Working directory: $(pwd)${NC}"
echo "Running: EAS_BUILD_PROFILE=release-client eas build --platform ios --profile release-client --non-interactive"
echo ""

if ! EAS_BUILD_PROFILE=release-client eas build --platform ios --profile release-client --non-interactive; then
    handle_error "EAS Build"
fi

echo -e "${GREEN}Build completed successfully!${NC}"
echo ""

# Step 7: Submit to App Store
echo -e "${YELLOW}Step 7: Submitting to App Store...${NC}"
echo "Running: EAS_BUILD_PROFILE=release-client eas submit --platform ios --non-interactive --latest"
echo ""

if ! EAS_BUILD_PROFILE=release-client eas submit --platform ios --non-interactive --latest; then
    handle_error "EAS Submit"
fi

echo -e "${GREEN}Submit completed successfully!${NC}"
echo ""

# Step 8: Restore macros.ts
echo -e "${YELLOW}Step 8: Restoring macros.ts...${NC}"
restore_macros
echo ""

# Step 9: Commit the restored macros.ts
echo -e "${YELLOW}Step 9: Committing restored macros.ts...${NC}"
cd "$EXPO_REPO_DIR"
git add "$MACROS_FILE"
git commit -m "Restore macros.ts after release build"
git push origin main
echo -e "${GREEN}Restored macros.ts committed and pushed${NC}"
echo ""

# Step 10: Send success notification
echo -e "${YELLOW}Step 10: Sending success notification...${NC}"
send_notification "✅ Build & Submit Success" "Vibra Code has been successfully built and submitted to the App Store!"

echo ""
echo "========================================"
echo -e "${GREEN}  All steps completed successfully!${NC}"
echo "========================================"
echo ""
echo "Your app has been submitted to App Store Connect."
echo "Check App Store Connect for review status."
