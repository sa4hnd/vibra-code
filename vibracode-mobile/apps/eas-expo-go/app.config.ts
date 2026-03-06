import { ExpoConfig } from '@expo/config';
import assert from 'assert';

const base = {
  ios: {
    bundleIdentifier: 'com.yourcompany.vibracode', // Replace with your bundle ID
    supportsTablet: false,
  },
  android: {
    package: 'com.yourcompany.vibracode', // Replace with your bundle ID
  },
  updates: {
    url: 'https://u.expo.dev/070e1bbb-2af9-4799-8f8d-9abc0cb4fa09',
  },
  runtimeVersion: '54.0.0',
};

const mapBuildProfileToConfig: Record<string, ExpoConfig> = {
  'versioned-client-add-sdk': {
    ...base,
    slug: 'vibra-code-versioned-add-sdk',
    name: 'Vibra Code (versioned) + add sdk',
    owner: 'your-expo-username', // Replace with your Expo account username
    extra: {
      eas: {
        projectId: '070e1bbb-2af9-4799-8f8d-9abc0cb4fa09',
      },
    },
  },
  'versioned-client': {
    ...base,
    slug: 'vibra-code',
    name: 'Vibra Code (versioned)',
    owner: 'your-expo-username', // Replace with your Expo account username
    extra: {
      eas: {
        projectId: '070e1bbb-2af9-4799-8f8d-9abc0cb4fa09',
      },
    },
  },
  'unversioned-client': {
    ...base,
    slug: 'vibra-code',
    name: 'Vibra Code (unversioned)',
    owner: 'your-expo-username', // Replace with your Expo account username
    extra: {
      eas: {
        projectId: '070e1bbb-2af9-4799-8f8d-9abc0cb4fa09',
      },
    },
  },
  'release-client': {
    ...base,
    slug: 'vibra-code',
    name: 'Vibra Code',
    owner: 'your-expo-username', // Replace with your Expo account username
    extra: {
      eas: {
        projectId: '070e1bbb-2af9-4799-8f8d-9abc0cb4fa09',
      },
    },
  },
  'publish-client': {
    ...base,
    slug: 'vibra-code',
    name: 'Vibra Code',
    owner: 'your-expo-username', // Replace with your Expo account username
    extra: {
      eas: {
        projectId: '070e1bbb-2af9-4799-8f8d-9abc0cb4fa09',
      },
    },
  },
};

const buildType = process.env.EAS_BUILD_PROFILE;
assert(
  buildType && mapBuildProfileToConfig[buildType],
  'Set EAS_BUILD_PROFILE=release-client to run an eas-cli command in this directory against the release project.'
);

const config = mapBuildProfileToConfig[buildType];
export default config;
