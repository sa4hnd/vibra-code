// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXEnvBridge.h"
#import <React/RCTLog.h>

// Default fallback values - set via environment variables
static NSString *const kDefaultConvexUrl = @"";
static NSString *const kDefaultV0ApiUrl = @"";
static NSString *const kDefaultProvisionHost = @"https://api.convex.dev";

// NSUserDefaults keys (matching EXPO_PUBLIC_* env vars)
static NSString *const kEnvKeyConvexUrl = @"EXPO_PUBLIC_CONVEX_URL";
static NSString *const kEnvKeyV0ApiUrl = @"EXPO_PUBLIC_V0_API_URL";
static NSString *const kEnvKeyApiUrl = @"EXPO_PUBLIC_API_URL";
static NSString *const kEnvKeyProvisionHost = @"EXPO_PUBLIC_PROVISION_HOST";
static NSString *const kEnvKeyClerkPublishableKey = @"EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY";
static NSString *const kEnvKeyConvexOAuthClientId = @"EXPO_PUBLIC_CONVEX_OAUTH_CLIENT_ID";
static NSString *const kEnvKeyRevenueCatApiKey = @"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY";

@implementation EXEnvBridge

RCT_EXPORT_MODULE(EXEnvBridge)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

#pragma mark - Public Class Methods

+ (NSString *)getEnvValue:(NSString *)key
{
  return [[NSUserDefaults standardUserDefaults] stringForKey:key];
}

+ (NSString *)convexUrl
{
  NSString *url = [self getEnvValue:kEnvKeyConvexUrl];
  if (url && url.length > 0) {
    return [url stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  }
  return kDefaultConvexUrl;
}

+ (NSString *)v0ApiUrl
{
  // Try V0 API URL first, then fall back to API URL
  NSString *url = [self getEnvValue:kEnvKeyV0ApiUrl];
  if (!url || url.length == 0) {
    url = [self getEnvValue:kEnvKeyApiUrl];
  }
  if (url && url.length > 0) {
    return [url stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  }
  return kDefaultV0ApiUrl;
}

+ (NSString *)provisionHost
{
  NSString *url = [self getEnvValue:kEnvKeyProvisionHost];
  if (url && url.length > 0) {
    return [url stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]];
  }
  return kDefaultProvisionHost;
}

#pragma mark - React Native Bridge Methods

/**
 * Sync all env vars from JS to NSUserDefaults
 * Call this at app startup from React Native
 */
RCT_EXPORT_METHOD(syncEnvVars:(NSDictionary *)envVars
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    NSInteger syncCount = 0;

    for (NSString *key in envVars) {
      id value = envVars[key];
      if ([value isKindOfClass:[NSString class]] && [(NSString *)value length] > 0) {
        [defaults setObject:value forKey:key];
        syncCount++;
        RCTLogInfo(@"[EXEnvBridge] Synced: %@ = %@", key,
                   [key containsString:@"KEY"] || [key containsString:@"SECRET"] ? @"***" : value);
      }
    }

    [defaults synchronize];

    RCTLogInfo(@"[EXEnvBridge] Synced %ld env vars to NSUserDefaults", (long)syncCount);
    resolve(@{@"success": @YES, @"syncedCount": @(syncCount)});
  }
  @catch (NSException *exception) {
    RCTLogError(@"[EXEnvBridge] Failed to sync env vars: %@", exception.reason);
    reject(@"SYNC_FAILED", exception.reason, nil);
  }
}

/**
 * Get a single env value
 */
RCT_EXPORT_METHOD(getEnv:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *value = [[self class] getEnvValue:key];
  resolve(value ?: [NSNull null]);
}

/**
 * Get all synced env vars
 */
RCT_EXPORT_METHOD(getAllEnvVars:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSArray *knownKeys = @[
    kEnvKeyConvexUrl,
    kEnvKeyV0ApiUrl,
    kEnvKeyApiUrl,
    kEnvKeyProvisionHost,
    kEnvKeyClerkPublishableKey,
    kEnvKeyConvexOAuthClientId,
    kEnvKeyRevenueCatApiKey
  ];

  NSMutableDictionary *envVars = [NSMutableDictionary dictionary];
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];

  for (NSString *key in knownKeys) {
    NSString *value = [defaults stringForKey:key];
    if (value) {
      // Mask sensitive keys
      if ([key containsString:@"KEY"] || [key containsString:@"SECRET"]) {
        envVars[key] = @"***";
      } else {
        envVars[key] = value;
      }
    }
  }

  resolve(envVars);
}

@end
