// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@protocol EXPreviewBottomBarDelegate <NSObject>
- (void)bottomBarChevronTapped;
@end

@interface EXPreviewBottomBar : NSObject

@property (nonatomic, weak) id<EXPreviewBottomBarDelegate> delegate;
@property (nonatomic, weak) id<UITextFieldDelegate> textFieldDelegate;
@property (nonatomic, strong, readonly) UIView *view;
@property (nonatomic, strong, readonly) UITextField *inputField;
@property (nonatomic, strong, readonly) NSLayoutConstraint *bottomConstraint;

- (instancetype)initWithSuperview:(UIView *)superview;
- (void)updateForKeyboardVisible:(BOOL)isVisible;

@end
