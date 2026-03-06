// Copyright 2020-present 650 Industries. All rights reserved.

#import "EXSafeUpdatesModule.h"
#import <EXUpdates/EXUpdatesDatabase.h>
#import <EXUpdates/EXUpdatesUtils.h>
#import <EXUpdates/EXUpdatesLogger.h>

@implementation EXSafeUpdatesModule

EX_EXPORT_MODULE(SafeUpdates);

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

EX_EXPORT_METHOD_AS(safeInsertUpdate,
                    safeInsertUpdate:(NSDictionary *)updateData
                    resolver:(EXPromiseResolveBlock)resolve
                    rejecter:(EXPromiseRejectBlock)reject)
{
  @try {
    // Get the updates database manager
    EXUpdatesDatabaseManager *dbManager = [EXKernel sharedInstance].serviceRegistry.updatesDatabaseManager;
    
    if (!dbManager.isDatabaseOpen) {
      [dbManager openDatabase];
    }
    
    if (!dbManager.isDatabaseOpen) {
      reject(@"DATABASE_ERROR", @"Failed to open database", nil);
      return;
    }
    
    // Use the safe insert method we added to the database manager
    NSError *error;
    BOOL success = [dbManager safeInsertUpdate:updateData error:&error];
    
    if (success) {
      resolve(@{@"success": @YES});
    } else {
      reject(@"INSERT_ERROR", error.localizedDescription, error);
    }
    
  } @catch (NSException *exception) {
    reject(@"EXCEPTION", exception.reason, nil);
  }
}

EX_EXPORT_METHOD_AS(cleanupDuplicateUpdates,
                    cleanupDuplicateUpdates:(EXPromiseResolveBlock)resolve
                    rejecter:(EXPromiseRejectBlock)reject)
{
  @try {
    // Get the updates database manager
    EXUpdatesDatabaseManager *dbManager = [EXKernel sharedInstance].serviceRegistry.updatesDatabaseManager;
    
    if (!dbManager.isDatabaseOpen) {
      [dbManager openDatabase];
    }
    
    if (!dbManager.isDatabaseOpen) {
      reject(@"DATABASE_ERROR", @"Failed to open database", nil);
      return;
    }
    
    // Use the cleanup method we added to the database manager
    NSError *error;
    BOOL success = [dbManager cleanupDuplicateUpdates:&error];
    
    if (success) {
      resolve(@{@"success": @YES, @"message": @"Database cleanup completed"});
    } else {
      reject(@"CLEANUP_ERROR", error.localizedDescription, error);
    }
    
  } @catch (NSException *exception) {
    reject(@"EXCEPTION", exception.reason, nil);
  }
}

EX_EXPORT_METHOD_AS(getDatabaseStats,
                    getDatabaseStats:(EXPromiseResolveBlock)resolve
                    rejecter:(EXPromiseRejectBlock)reject)
{
  @try {
    // Get the updates database manager
    EXUpdatesDatabaseManager *dbManager = [EXKernel sharedInstance].serviceRegistry.updatesDatabaseManager;
    
    if (!dbManager.isDatabaseOpen) {
      [dbManager openDatabase];
    }
    
    if (!dbManager.isDatabaseOpen) {
      reject(@"DATABASE_ERROR", @"Failed to open database", nil);
      return;
    }
    
    // Get database statistics
    NSDictionary *stats = @{
      @"isOpen": @(dbManager.isDatabaseOpen),
      @"updatesDirectory": dbManager.updatesDirectory.absoluteString ?: @"",
      @"hasError": @(dbManager.error != nil),
      @"errorMessage": dbManager.error.localizedDescription ?: @""
    };
    
    resolve(stats);
    
  } @catch (NSException *exception) {
    reject(@"EXCEPTION", exception.reason, nil);
  }
}

@end
