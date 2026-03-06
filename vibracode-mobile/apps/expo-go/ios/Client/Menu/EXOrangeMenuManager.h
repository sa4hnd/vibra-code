// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <Expo/RCTAppDelegateUmbrella.h>

@protocol EXOrangeMenuManagerDelegate <NSObject>

- (RCTReactNativeFactory *)appDelegateForOrangeMenuManager:(id)manager;

@end

@interface EXOrangeMenuManager : NSObject

@property (nonatomic, weak) id<EXOrangeMenuManagerDelegate> delegate;

+ (instancetype)sharedInstance;

- (RCTReactNativeFactory *)mainAppFactory;

- (BOOL)isVisible;
- (BOOL)showOrangeMenu;
- (BOOL)hideOrangeMenu;
- (BOOL)toggleOrangeMenu;
- (void)updateWindowLevel;

@end
