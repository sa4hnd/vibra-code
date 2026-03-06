// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@protocol EXPreviewZoomViewDelegate <NSObject>
@optional
- (void)previewZoomViewDidRequestZoomIn;
- (void)previewZoomViewDidRequestDismissKeyboard;
@end

@interface EXPreviewZoomView : NSObject

@property (nonatomic, weak) id<EXPreviewZoomViewDelegate> delegate;
@property (nonatomic, strong, readonly) UIView *previewContainerView;
@property (nonatomic, assign, readonly) BOOL isZoomed;
@property (nonatomic, assign) CATransform3D originalPreviewTransform;

- (void)zoomOutWithContentView:(UIView *)contentView
                      superview:(UIView *)superview
                     completion:(void (^)(void))completion;

- (void)zoomInWithContentView:(UIView *)contentView
                    superview:(UIView *)superview
                   completion:(void (^)(void))completion;

- (void)handleContentViewReplacement:(UIView *)newContentView;
- (void)reapplyBackgroundColor;
- (void)cleanup;

- (void)updateTransformForKeyboardHeight:(CGFloat)keyboardHeight;
- (void)restoreTransform;

@end

