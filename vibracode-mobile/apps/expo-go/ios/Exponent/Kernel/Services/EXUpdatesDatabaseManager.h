// Copyright 2020-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>

@import EXUpdates;

NS_ASSUME_NONNULL_BEGIN

@interface EXUpdatesDatabaseManager : NSObject

@property (nonatomic, readonly) NSURL *updatesDirectory;
@property (nonatomic, readonly) EXUpdatesDatabase *database;
@property (nonatomic, readonly) BOOL isDatabaseOpen;
@property (nonatomic, readonly, nullable) NSError *error;

- (BOOL)openDatabase;

// NEW: Safe methods to handle update insertions and cleanup
- (BOOL)safeInsertUpdate:(EXUpdatesUpdate *)update error:(NSError **)error;
- (BOOL)cleanupDuplicateUpdates:(NSError **)error;

@end

NS_ASSUME_NONNULL_END