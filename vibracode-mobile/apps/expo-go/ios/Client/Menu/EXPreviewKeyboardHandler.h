// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@class EXPreviewZoomView;
@class EXPreviewBottomBar;
@class EXPreviewChatView;

@interface EXPreviewKeyboardHandler : NSObject

@property (nonatomic, weak) EXPreviewZoomView *previewZoomView;
@property (nonatomic, weak) EXPreviewBottomBar *bottomBar;
@property (nonatomic, weak) EXPreviewChatView *chatView;
@property (nonatomic, assign, readonly) BOOL isKeyboardVisible;

- (void)startObserving;
- (void)stopObserving;

@end

