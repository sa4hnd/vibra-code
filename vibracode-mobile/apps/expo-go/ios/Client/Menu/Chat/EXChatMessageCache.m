// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatMessageCache.h"
#import <Realm/Realm.h>

#pragma mark - Realm Models

// Realm model for cached message
@interface EXCachedMessage : RLMObject
@property NSString *messageId;
@property NSString *sessionId;
@property NSData *messageData; // JSON serialized message dict
@property NSDate *cachedAt;
@property NSInteger sortIndex;
@end

@implementation EXCachedMessage
+ (NSString *)primaryKey {
  return @"messageId";
}
+ (NSArray<NSString *> *)indexedProperties {
  return @[@"sessionId", @"sortIndex"];
}
@end

// Realm model for cached session
@interface EXCachedSession : RLMObject
@property NSString *sessionId;
@property NSData *sessionData; // JSON serialized session dict
@property NSDate *cachedAt;
@property NSString *lastViewedMessageId;
@end

@implementation EXCachedSession
+ (NSString *)primaryKey {
  return @"sessionId";
}
@end

// Realm model for cached images (Image Studio)
@interface EXCachedImage : RLMObject
@property NSString *imageId;
@property NSString *sessionId;
@property NSData *imageData; // JSON serialized image dict
@property NSDate *cachedAt;
@end

@implementation EXCachedImage
+ (NSString *)primaryKey {
  return @"imageId";
}
+ (NSArray<NSString *> *)indexedProperties {
  return @[@"sessionId"];
}
@end

// Realm model for cached audios (Audio Studio)
@interface EXCachedAudio : RLMObject
@property NSString *audioId;
@property NSString *sessionId;
@property NSData *audioData; // JSON serialized audio dict
@property NSDate *cachedAt;
@end

@implementation EXCachedAudio
+ (NSString *)primaryKey {
  return @"audioId";
}
+ (NSArray<NSString *> *)indexedProperties {
  return @[@"sessionId"];
}
@end

// Realm model for cached videos (Video Studio)
@interface EXCachedVideo : RLMObject
@property NSString *videoId;
@property NSString *sessionId;
@property NSData *videoData; // JSON serialized video dict
@property NSDate *cachedAt;
@end

@implementation EXCachedVideo
+ (NSString *)primaryKey {
  return @"videoId";
}
+ (NSArray<NSString *> *)indexedProperties {
  return @[@"sessionId"];
}
@end

// Realm model for manifest URL -> session ID mapping (for instant lookup on chat open)
@interface EXManifestSessionMapping : RLMObject
@property NSString *manifestUrl;
@property NSString *sessionId;
@property NSDate *cachedAt;
@end

@implementation EXManifestSessionMapping
+ (NSString *)primaryKey {
  return @"manifestUrl";
}
@end

#pragma mark - EXChatMessageCache Implementation

@interface EXChatMessageCache ()
@property (nonatomic, strong) RLMRealm *realm;
@property (nonatomic, strong) dispatch_queue_t cacheQueue;
@end

@implementation EXChatMessageCache

+ (instancetype)sharedInstance {
  static EXChatMessageCache *instance = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    instance = [[EXChatMessageCache alloc] init];
  });
  return instance;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _cacheQueue = dispatch_queue_create("com.expo.chatcache", DISPATCH_QUEUE_SERIAL);
    [self setupRealm];
  }
  return self;
}

- (void)setupRealm {
  // Configure Realm for chat cache
  RLMRealmConfiguration *config = [RLMRealmConfiguration defaultConfiguration];

  // Use a separate Realm file for chat cache
  NSString *cachePath = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
  config.fileURL = [NSURL fileURLWithPath:[cachePath stringByAppendingPathComponent:@"chat_cache.realm"]];

  // Schema version for migrations
  config.schemaVersion = 3;

  // Migration block (for future schema changes)
  config.migrationBlock = ^(RLMMigration *migration, uint64_t oldSchemaVersion) {
    // Handle migrations here if needed
  };

  // Compact on launch if over 100MB
  config.shouldCompactOnLaunch = ^BOOL(NSUInteger totalBytes, NSUInteger usedBytes) {
    NSUInteger oneHundredMB = 100 * 1024 * 1024;
    return (totalBytes > oneHundredMB) && ((double)usedBytes / totalBytes < 0.5);
  };

  NSError *error = nil;
  self.realm = [RLMRealm realmWithConfiguration:config error:&error];

  if (error) {
    NSLog(@"[EXChatMessageCache] Failed to open Realm: %@", error);
    // Fall back to in-memory realm
    config.inMemoryIdentifier = @"chat_cache_fallback";
    self.realm = [RLMRealm realmWithConfiguration:config error:nil];
  }
}

#pragma mark - Session Cache

- (NSArray<NSDictionary *> *)cachedMessagesForSession:(NSString *)sessionId {
  if (!sessionId) return @[];

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  // Query messages sorted by index
  RLMResults<EXCachedMessage *> *results = [[EXCachedMessage objectsInRealm:self.realm
                                                                     where:@"sessionId == %@", sessionId]
                                            sortedResultsUsingKeyPath:@"sortIndex"
                                                            ascending:YES];

  NSMutableArray *messages = [NSMutableArray arrayWithCapacity:results.count];
  for (EXCachedMessage *cached in results) {
    NSDictionary *message = [self deserializeData:cached.messageData];
    if (message) {
      [messages addObject:message];
    }
  }

  return messages;
}

- (nullable NSDictionary *)cachedSessionForSessionId:(NSString *)sessionId {
  if (!sessionId) return nil;

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  EXCachedSession *cached = [EXCachedSession objectInRealm:self.realm forPrimaryKey:sessionId];
  if (cached) {
    return [self deserializeData:cached.sessionData];
  }
  return nil;
}

- (void)cacheMessages:(NSArray<NSDictionary *> *)messages
         forSession:(NSString *)sessionId {
  if (!sessionId || messages.count == 0) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        // Clear existing messages for this session
        RLMResults<EXCachedMessage *> *existing = [EXCachedMessage objectsInRealm:bgRealm
                                                                           where:@"sessionId == %@", sessionId];
        [bgRealm deleteObjects:existing];

        // Insert new messages
        NSInteger index = 0;
        for (NSDictionary *message in messages) {
          NSString *messageId = message[@"_id"];
          if (!messageId) continue;

          EXCachedMessage *cached = [[EXCachedMessage alloc] init];
          cached.messageId = messageId;
          cached.sessionId = sessionId;
          cached.messageData = [self serializeDict:message];
          cached.cachedAt = [NSDate date];
          cached.sortIndex = index++;

          [bgRealm addOrUpdateObject:cached];
        }
      }];
    }
  });
}

- (void)cacheSession:(NSDictionary *)session
      forSessionId:(NSString *)sessionId {
  if (!sessionId || !session) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        EXCachedSession *cached = [EXCachedSession objectInRealm:bgRealm forPrimaryKey:sessionId];
        if (!cached) {
          cached = [[EXCachedSession alloc] init];
          cached.sessionId = sessionId;
        }
        cached.sessionData = [self serializeDict:session];
        cached.cachedAt = [NSDate date];

        [bgRealm addOrUpdateObject:cached];
      }];
    }
  });
}

- (void)updateMessage:(NSDictionary *)message
         forSession:(NSString *)sessionId {
  if (!sessionId || !message) return;

  NSString *messageId = message[@"_id"];
  if (!messageId) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        EXCachedMessage *cached = [EXCachedMessage objectInRealm:bgRealm forPrimaryKey:messageId];
        if (cached) {
          cached.messageData = [self serializeDict:message];
          cached.cachedAt = [NSDate date];
        } else {
          // New message - get max index and add
          RLMResults<EXCachedMessage *> *existing = [[EXCachedMessage objectsInRealm:bgRealm
                                                                              where:@"sessionId == %@", sessionId]
                                                     sortedResultsUsingKeyPath:@"sortIndex"
                                                                     ascending:NO];
          NSInteger maxIndex = existing.count > 0 ? existing.firstObject.sortIndex + 1 : 0;

          EXCachedMessage *newCached = [[EXCachedMessage alloc] init];
          newCached.messageId = messageId;
          newCached.sessionId = sessionId;
          newCached.messageData = [self serializeDict:message];
          newCached.cachedAt = [NSDate date];
          newCached.sortIndex = maxIndex;

          [bgRealm addOrUpdateObject:newCached];
        }
      }];
    }
  });
}

- (void)clearCacheForSession:(NSString *)sessionId {
  if (!sessionId) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        // Delete messages
        RLMResults<EXCachedMessage *> *messages = [EXCachedMessage objectsInRealm:bgRealm
                                                                           where:@"sessionId == %@", sessionId];
        [bgRealm deleteObjects:messages];

        // Delete session
        EXCachedSession *session = [EXCachedSession objectInRealm:bgRealm forPrimaryKey:sessionId];
        if (session) {
          [bgRealm deleteObject:session];
        }

        // Delete images
        RLMResults<EXCachedImage *> *images = [EXCachedImage objectsInRealm:bgRealm
                                                                     where:@"sessionId == %@", sessionId];
        [bgRealm deleteObjects:images];

        // Delete audios
        RLMResults<EXCachedAudio *> *audios = [EXCachedAudio objectsInRealm:bgRealm
                                                                     where:@"sessionId == %@", sessionId];
        [bgRealm deleteObjects:audios];

        // Delete videos
        RLMResults<EXCachedVideo *> *videos = [EXCachedVideo objectsInRealm:bgRealm
                                                                     where:@"sessionId == %@", sessionId];
        [bgRealm deleteObjects:videos];
      }];
    }
  });
}

- (void)clearAllCache {
  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        [bgRealm deleteAllObjects];
      }];
    }
  });
}

#pragma mark - Image Cache

- (NSArray<NSDictionary *> *)cachedImagesForSession:(NSString *)sessionId {
  if (!sessionId) return @[];

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  RLMResults<EXCachedImage *> *results = [[EXCachedImage objectsInRealm:self.realm
                                                                 where:@"sessionId == %@", sessionId]
                                          sortedResultsUsingKeyPath:@"cachedAt"
                                                          ascending:NO];

  NSMutableArray *images = [NSMutableArray arrayWithCapacity:results.count];
  for (EXCachedImage *cached in results) {
    NSDictionary *image = [self deserializeData:cached.imageData];
    if (image) {
      [images addObject:image];
    }
  }

  return images;
}

- (void)cacheImages:(NSArray<NSDictionary *> *)images
       forSession:(NSString *)sessionId {
  if (!sessionId || images.count == 0) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        for (NSDictionary *image in images) {
          NSString *imageId = image[@"_id"];
          if (!imageId) continue;

          EXCachedImage *cached = [[EXCachedImage alloc] init];
          cached.imageId = imageId;
          cached.sessionId = sessionId;
          cached.imageData = [self serializeDict:image];
          cached.cachedAt = [NSDate date];

          [bgRealm addOrUpdateObject:cached];
        }
      }];
    }
  });
}

#pragma mark - Audio Cache

- (NSArray<NSDictionary *> *)cachedAudiosForSession:(NSString *)sessionId {
  if (!sessionId) return @[];

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  RLMResults<EXCachedAudio *> *results = [[EXCachedAudio objectsInRealm:self.realm
                                                                 where:@"sessionId == %@", sessionId]
                                          sortedResultsUsingKeyPath:@"cachedAt"
                                                          ascending:NO];

  NSMutableArray *audios = [NSMutableArray arrayWithCapacity:results.count];
  for (EXCachedAudio *cached in results) {
    NSDictionary *audio = [self deserializeData:cached.audioData];
    if (audio) {
      [audios addObject:audio];
    }
  }

  return audios;
}

- (void)cacheAudios:(NSArray<NSDictionary *> *)audios
       forSession:(NSString *)sessionId {
  if (!sessionId || audios.count == 0) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        for (NSDictionary *audio in audios) {
          NSString *audioId = audio[@"_id"];
          if (!audioId) continue;

          EXCachedAudio *cached = [[EXCachedAudio alloc] init];
          cached.audioId = audioId;
          cached.sessionId = sessionId;
          cached.audioData = [self serializeDict:audio];
          cached.cachedAt = [NSDate date];

          [bgRealm addOrUpdateObject:cached];
        }
      }];
    }
  });
}

#pragma mark - Video Cache

- (NSArray<NSDictionary *> *)cachedVideosForSession:(NSString *)sessionId {
  if (!sessionId) return @[];

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  RLMResults<EXCachedVideo *> *results = [[EXCachedVideo objectsInRealm:self.realm
                                                                 where:@"sessionId == %@", sessionId]
                                          sortedResultsUsingKeyPath:@"cachedAt"
                                                          ascending:NO];

  NSMutableArray *videos = [NSMutableArray arrayWithCapacity:results.count];
  for (EXCachedVideo *cached in results) {
    NSDictionary *video = [self deserializeData:cached.videoData];
    if (video) {
      [videos addObject:video];
    }
  }

  return videos;
}

- (void)cacheVideos:(NSArray<NSDictionary *> *)videos
       forSession:(NSString *)sessionId {
  if (!sessionId || videos.count == 0) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        for (NSDictionary *video in videos) {
          NSString *videoId = video[@"_id"];
          if (!videoId) continue;

          EXCachedVideo *cached = [[EXCachedVideo alloc] init];
          cached.videoId = videoId;
          cached.sessionId = sessionId;
          cached.videoData = [self serializeDict:video];
          cached.cachedAt = [NSDate date];

          [bgRealm addOrUpdateObject:cached];
        }
      }];
    }
  });
}

#pragma mark - Last Viewed

- (nullable NSString *)lastViewedMessageIdForSession:(NSString *)sessionId {
  if (!sessionId) return nil;

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  EXCachedSession *cached = [EXCachedSession objectInRealm:self.realm forPrimaryKey:sessionId];
  return cached.lastViewedMessageId;
}

- (void)setLastViewedMessageId:(NSString *)messageId
                   forSession:(NSString *)sessionId {
  if (!sessionId) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        EXCachedSession *cached = [EXCachedSession objectInRealm:bgRealm forPrimaryKey:sessionId];
        if (cached) {
          cached.lastViewedMessageId = messageId;
        }
      }];
    }
  });
}

#pragma mark - Cache Status

- (BOOL)hasCacheForSession:(NSString *)sessionId {
  if (!sessionId) return NO;

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  EXCachedSession *cached = [EXCachedSession objectInRealm:self.realm forPrimaryKey:sessionId];
  return cached != nil;
}

- (nullable NSDate *)cacheTimestampForSession:(NSString *)sessionId {
  if (!sessionId) return nil;

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  EXCachedSession *cached = [EXCachedSession objectInRealm:self.realm forPrimaryKey:sessionId];
  return cached.cachedAt;
}

#pragma mark - Helpers

- (RLMRealm *)backgroundRealm {
  RLMRealmConfiguration *config = [RLMRealmConfiguration defaultConfiguration];
  NSString *cachePath = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
  config.fileURL = [NSURL fileURLWithPath:[cachePath stringByAppendingPathComponent:@"chat_cache.realm"]];
  config.schemaVersion = 2;

  NSError *error = nil;
  RLMRealm *realm = [RLMRealm realmWithConfiguration:config error:&error];
  if (error) {
    NSLog(@"[EXChatMessageCache] Failed to open background Realm: %@", error);
    return nil;
  }
  return realm;
}

- (NSData *)serializeDict:(NSDictionary *)dict {
  if (!dict) return nil;
  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:&error];
  if (error) {
    NSLog(@"[EXChatMessageCache] Serialization error: %@", error);
    return nil;
  }
  return data;
}

- (NSDictionary *)deserializeData:(NSData *)data {
  if (!data) return nil;
  NSError *error = nil;
  NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
  if (error) {
    NSLog(@"[EXChatMessageCache] Deserialization error: %@", error);
    return nil;
  }
  return dict;
}

#pragma mark - Manifest URL Mapping

- (nullable NSString *)cachedSessionIdForManifestUrl:(NSString *)manifestUrl {
  if (!manifestUrl) return nil;

  // Refresh to see latest writes from background queue
  [self.realm refresh];

  EXManifestSessionMapping *mapping = [EXManifestSessionMapping objectInRealm:self.realm forPrimaryKey:manifestUrl];
  return mapping.sessionId;
}

- (void)cacheSessionId:(NSString *)sessionId forManifestUrl:(NSString *)manifestUrl {
  if (!sessionId || !manifestUrl) return;

  dispatch_async(self.cacheQueue, ^{
    @autoreleasepool {
      RLMRealm *bgRealm = [self backgroundRealm];
      if (!bgRealm) return;

      [bgRealm transactionWithBlock:^{
        EXManifestSessionMapping *mapping = [EXManifestSessionMapping objectInRealm:bgRealm forPrimaryKey:manifestUrl];
        if (!mapping) {
          mapping = [[EXManifestSessionMapping alloc] init];
          mapping.manifestUrl = manifestUrl;
        }
        mapping.sessionId = sessionId;
        mapping.cachedAt = [NSDate date];

        [bgRealm addOrUpdateObject:mapping];
      }];
    }
  });
}

@end
