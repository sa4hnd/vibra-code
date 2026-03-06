// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * EXChatMessageCache - Local message cache using Realm
 *
 * Purpose:
 * - Cache messages locally for instant chat loading
 * - Sync with Convex in background
 * - Eliminate "Loading..." delays when opening chat
 *
 * Usage:
 * 1. On chat open: Load from cache instantly, then sync with server
 * 2. On new message: Save to cache immediately
 * 3. On refresh: Update cache with server data
 */
@interface EXChatMessageCache : NSObject

+ (instancetype)sharedInstance;

#pragma mark - Session Cache

// Get cached messages for a session (instant, from local Realm)
- (NSArray<NSDictionary *> *)cachedMessagesForSession:(NSString *)sessionId;

// Get cached session data (status, statusMessage, etc.)
- (nullable NSDictionary *)cachedSessionForSessionId:(NSString *)sessionId;

// Save messages to local cache
- (void)cacheMessages:(NSArray<NSDictionary *> *)messages
         forSession:(NSString *)sessionId;

// Save session data to local cache
- (void)cacheSession:(NSDictionary *)session
      forSessionId:(NSString *)sessionId;

// Update single message in cache (for streaming updates)
- (void)updateMessage:(NSDictionary *)message
         forSession:(NSString *)sessionId;

// Clear cache for a session
- (void)clearCacheForSession:(NSString *)sessionId;

// Clear all cached data
- (void)clearAllCache;

#pragma mark - Image Cache

// Cache generated images for Image Studio
- (NSArray<NSDictionary *> *)cachedImagesForSession:(NSString *)sessionId;
- (void)cacheImages:(NSArray<NSDictionary *> *)images
       forSession:(NSString *)sessionId;

#pragma mark - Audio Cache

// Cache generated audios for Audio Studio
- (NSArray<NSDictionary *> *)cachedAudiosForSession:(NSString *)sessionId;
- (void)cacheAudios:(NSArray<NSDictionary *> *)audios
       forSession:(NSString *)sessionId;

#pragma mark - Video Cache

// Cache generated videos for Video Studio
- (NSArray<NSDictionary *> *)cachedVideosForSession:(NSString *)sessionId;
- (void)cacheVideos:(NSArray<NSDictionary *> *)videos
       forSession:(NSString *)sessionId;

#pragma mark - Last Viewed

// Track last viewed message for scroll position
- (nullable NSString *)lastViewedMessageIdForSession:(NSString *)sessionId;
- (void)setLastViewedMessageId:(NSString *)messageId
                   forSession:(NSString *)sessionId;

#pragma mark - Cache Status

// Check if we have cached data for a session
- (BOOL)hasCacheForSession:(NSString *)sessionId;

// Get cache timestamp (for staleness check)
- (nullable NSDate *)cacheTimestampForSession:(NSString *)sessionId;

#pragma mark - Manifest URL Mapping (for instant session lookup)

// Get cached sessionId for a manifest URL (instant lookup on chat open)
- (nullable NSString *)cachedSessionIdForManifestUrl:(NSString *)manifestUrl;

// Save manifest URL -> sessionId mapping for instant future lookups
- (void)cacheSessionId:(NSString *)sessionId forManifestUrl:(NSString *)manifestUrl;

@end

NS_ASSUME_NONNULL_END
