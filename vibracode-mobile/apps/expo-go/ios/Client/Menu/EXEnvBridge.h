// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Bridge module to sync React Native environment variables to NSUserDefaults
 * This allows native iOS code to read env vars set in the .env file
 */
@interface EXEnvBridge : NSObject <RCTBridgeModule>

/**
 * Get an env value from NSUserDefaults
 * @param key The env variable name (e.g., "EXPO_PUBLIC_CONVEX_URL")
 * @return The value or nil if not set
 */
+ (NSString * _Nullable)getEnvValue:(NSString *)key;

/**
 * Get Convex URL with fallback
 */
+ (NSString *)convexUrl;

/**
 * Get V0 API URL with fallback
 */
+ (NSString *)v0ApiUrl;

/**
 * Get Provision Host URL with fallback
 */
+ (NSString *)provisionHost;

@end

NS_ASSUME_NONNULL_END
