// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@protocol EXPreviewTopBarDelegate <NSObject>
- (void)topBarHomeButtonPressed;
- (void)topBarRefreshButtonPressed;
- (void)topBarChevronDownPressed;
@end

@interface EXPreviewTopBar : NSObject

@property (nonatomic, weak) id<EXPreviewTopBarDelegate> delegate;
@property (nonatomic, strong, readonly) UIView *view;

- (instancetype)initWithSuperview:(UIView *)superview appName:(NSString *)appName;
- (void)setAppName:(NSString *)appName;
- (void)updateForChatMode:(BOOL)isChatMode;

@end
