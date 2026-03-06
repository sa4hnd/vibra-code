// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewTopBar.h"
#import "EXKernel.h"
#import "EXKernelAppRecord.h"
#import "EXAbstractLoader.h"
#import "EXManifests-Swift.h"

@import EXManifests;

@interface EXPreviewTopBar ()

@property (nonatomic, strong) UIView *topBarView;
@property (nonatomic, strong) UILabel *appNameLabel;
@property (nonatomic, strong) UIButton *threeDotsButton;
@property (nonatomic, strong) UIButton *refreshButton;
@property (nonatomic, strong) UIButton *chevronDownButton;
@property (nonatomic, strong) UIButton *clearHistoryButton;

@end

@implementation EXPreviewTopBar

#pragma mark - Device Detection

- (BOOL)isIPad
{
  return UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad;
}

- (UIView *)createTopBarView:(UIView *)superview withAppRecord:(EXKernelAppRecord *)appRecord appName:(NSString *)appNameFromConvex
{
  if (!appRecord) {
    return nil;
  }
  
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return nil;
  }
  
  // Get safe area from the view controller's view
  CGFloat safeAreaTop = 0;
  if (@available(iOS 11.0, *)) {
    if ([superview respondsToSelector:@selector(safeAreaInsets)]) {
      safeAreaTop = [superview safeAreaInsets].top;
    }
    if (safeAreaTop == 0) {
      safeAreaTop = window.safeAreaInsets.top;
    }
  }
  
  CGFloat topBarTopPadding = safeAreaTop + ([self isIPad] ? 14 : 10);

  // Responsive dimensions
  CGFloat cornerRadius = [self isIPad] ? 28.0 : 20.0;
  CGFloat contentHeight = [self isIPad] ? 56 : 44;
  CGFloat buttonSize = [self isIPad] ? 56 : 44;
  CGFloat sidePadding = [self isIPad] ? 24 : 16;
  CGFloat iconSize = [self isIPad] ? 24 : 20;
  CGFloat labelSpacing = [self isIPad] ? 16 : 12;
  CGFloat fontSize = [self isIPad] ? 20 : 17;

  // Create main container view
  UIView *topBar = [[UIView alloc] init];
  topBar.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
  topBar.layer.cornerRadius = cornerRadius;
  topBar.layer.maskedCorners = kCALayerMinXMaxYCorner | kCALayerMaxXMaxYCorner;
  topBar.translatesAutoresizingMaskIntoConstraints = NO;
  
  // Get app name - prefer Convex database name, fallback to manifest name
  NSString *appName = appNameFromConvex ?: @"App";
  
  // If no Convex name set, try to get from manifest as fallback
  if ([appName isEqualToString:@"App"] && appRecord && appRecord.appLoader.manifest) {
    @try {
      EXManifestsManifest *manifest = appRecord.appLoader.manifest;
      NSDictionary *rawManifest = manifest.rawManifestJSON;
      
      if (rawManifest && [rawManifest isKindOfClass:[NSDictionary class]]) {
        NSDictionary *extra = rawManifest[@"extra"];
        if ([extra isKindOfClass:[NSDictionary class]]) {
          NSDictionary *expoClient = extra[@"expoClient"];
          if ([expoClient isKindOfClass:[NSDictionary class]]) {
            NSString *expoClientName = expoClient[@"name"];
            if ([expoClientName isKindOfClass:[NSString class]] && expoClientName.length > 0) {
              appName = expoClientName;
            }
          }
        }
        
        if ([appName isEqualToString:@"App"]) {
          NSString *manifestName = rawManifest[@"name"];
          if ([manifestName isKindOfClass:[NSString class]] && manifestName.length > 0) {
            appName = manifestName;
          }
        }
      }
    } @catch (NSException *exception) {
      appName = @"App";
    }
  }
  
  // Add top bar to superview BEFORE creating constraints
  [superview addSubview:topBar];
  
  // Force layout pass to ensure safe area is calculated
  [superview setNeedsLayout];
  [superview layoutIfNeeded];
  
  // Recalculate safe area AFTER layout
  if (@available(iOS 11.0, *)) {
    if ([superview respondsToSelector:@selector(safeAreaInsets)]) {
      CGFloat newSafeAreaTop = [superview safeAreaInsets].top;
      if (newSafeAreaTop > 0) {
        safeAreaTop = newSafeAreaTop;
        topBarTopPadding = safeAreaTop + ([self isIPad] ? 14 : 10);
      }
    }
  }

  // Create content container for buttons
  UIView *contentContainer = [[UIView alloc] init];
  contentContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [topBar addSubview:contentContainer];

  // Home button
  UIImageSymbolConfiguration *homeConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *homeImage = [UIImage systemImageNamed:@"house.fill" withConfiguration:homeConfig];
  UIButton *homeButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [homeButton setImage:homeImage forState:UIControlStateNormal];
  homeButton.tintColor = [UIColor whiteColor];
  homeButton.translatesAutoresizingMaskIntoConstraints = NO;
  [homeButton addTarget:self action:@selector(handleHomeButtonPress:) forControlEvents:UIControlEventTouchUpInside];
  [contentContainer addSubview:homeButton];

  // App name label
  _appNameLabel = [[UILabel alloc] init];
  _appNameLabel.text = appName;
  _appNameLabel.textColor = [UIColor whiteColor];
  _appNameLabel.font = [UIFont systemFontOfSize:fontSize weight:UIFontWeightSemibold];
  _appNameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:_appNameLabel];

  // Three dots button
  UIImageSymbolConfiguration *dotsConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *dotsImage = [UIImage systemImageNamed:@"ellipsis" withConfiguration:dotsConfig];
  UIButton *dotsButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [dotsButton setImage:dotsImage forState:UIControlStateNormal];
  dotsButton.tintColor = [UIColor whiteColor];
  dotsButton.translatesAutoresizingMaskIntoConstraints = NO;
  [contentContainer addSubview:dotsButton];
  _threeDotsButton = dotsButton;

  // Refresh button
  UIImageSymbolConfiguration *refreshConfig = [UIImageSymbolConfiguration configurationWithPointSize:iconSize weight:UIImageSymbolWeightRegular];
  UIImage *refreshImage = [UIImage systemImageNamed:@"arrow.clockwise" withConfiguration:refreshConfig];
  UIButton *refreshButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [refreshButton setImage:refreshImage forState:UIControlStateNormal];
  refreshButton.tintColor = [UIColor whiteColor];
  refreshButton.translatesAutoresizingMaskIntoConstraints = NO;
  [refreshButton addTarget:self action:@selector(handleRefreshButtonPress:) forControlEvents:UIControlEventTouchUpInside];
  [contentContainer addSubview:refreshButton];
  _refreshButton = refreshButton;

  // Layout constraints
  [NSLayoutConstraint activateConstraints:@[
    [contentContainer.leadingAnchor constraintEqualToAnchor:topBar.leadingAnchor],
    [contentContainer.trailingAnchor constraintEqualToAnchor:topBar.trailingAnchor],
    [contentContainer.topAnchor constraintEqualToAnchor:topBar.topAnchor constant:topBarTopPadding],
    [contentContainer.heightAnchor constraintEqualToConstant:contentHeight],

    [homeButton.leadingAnchor constraintEqualToAnchor:contentContainer.leadingAnchor constant:sidePadding],
    [homeButton.centerYAnchor constraintEqualToAnchor:contentContainer.centerYAnchor],
    [homeButton.widthAnchor constraintEqualToConstant:buttonSize],
    [homeButton.heightAnchor constraintEqualToConstant:buttonSize],

    [_appNameLabel.leadingAnchor constraintEqualToAnchor:homeButton.trailingAnchor constant:labelSpacing],
    [_appNameLabel.centerYAnchor constraintEqualToAnchor:contentContainer.centerYAnchor],

    [refreshButton.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor constant:-sidePadding],
    [refreshButton.centerYAnchor constraintEqualToAnchor:contentContainer.centerYAnchor],
    [refreshButton.widthAnchor constraintEqualToConstant:buttonSize],
    [refreshButton.heightAnchor constraintEqualToConstant:buttonSize],

    [dotsButton.trailingAnchor constraintEqualToAnchor:refreshButton.leadingAnchor constant:-labelSpacing],
    [dotsButton.centerYAnchor constraintEqualToAnchor:contentContainer.centerYAnchor],
    [dotsButton.widthAnchor constraintEqualToConstant:buttonSize],
    [dotsButton.heightAnchor constraintEqualToConstant:buttonSize],

    [topBar.leadingAnchor constraintEqualToAnchor:superview.leadingAnchor],
    [topBar.trailingAnchor constraintEqualToAnchor:superview.trailingAnchor],
    [topBar.topAnchor constraintEqualToAnchor:superview.topAnchor],
    [topBar.heightAnchor constraintEqualToConstant:contentHeight + topBarTopPadding]
  ]];
  
  // Add chevron down button (initially hidden, shown in chat mode)
  CGFloat chevronIconSize = [self isIPad] ? 20 : 16;
  CGFloat clearHistoryFontSize = [self isIPad] ? 18 : 16;
  CGFloat clearHistoryIconSize = [self isIPad] ? 20 : 16;
  CGFloat clearHistorySpacing = [self isIPad] ? 8 : 6;

  UIImageSymbolConfiguration *chevronDownConfig = [UIImageSymbolConfiguration configurationWithPointSize:chevronIconSize weight:UIImageSymbolWeightRegular];
  UIImage *chevronDownImage = [UIImage systemImageNamed:@"chevron.down" withConfiguration:chevronDownConfig];
  UIButton *chevronDownButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [chevronDownButton setImage:chevronDownImage forState:UIControlStateNormal];
  chevronDownButton.tintColor = [UIColor whiteColor];
  chevronDownButton.translatesAutoresizingMaskIntoConstraints = NO;
  chevronDownButton.hidden = YES;
  [chevronDownButton addTarget:self action:@selector(handleToggleChat:) forControlEvents:UIControlEventTouchUpInside];
  [contentContainer addSubview:chevronDownButton];
  _chevronDownButton = chevronDownButton;

  // Add Clear history button (initially hidden, shown in chat mode)
  UIButton *clearHistoryButton = [UIButton buttonWithType:UIButtonTypeCustom];
  clearHistoryButton.translatesAutoresizingMaskIntoConstraints = NO;
  clearHistoryButton.hidden = YES;

  UIImageSymbolConfiguration *clearHistoryIconConfig = [UIImageSymbolConfiguration configurationWithPointSize:clearHistoryIconSize weight:UIImageSymbolWeightRegular];
  UIImage *clearHistoryIconImage = [UIImage systemImageNamed:@"arrow.clockwise" withConfiguration:clearHistoryIconConfig];
  UIImageView *clearHistoryIcon = [[UIImageView alloc] initWithImage:clearHistoryIconImage];
  clearHistoryIcon.tintColor = [UIColor whiteColor];
  clearHistoryIcon.translatesAutoresizingMaskIntoConstraints = NO;

  UILabel *clearHistoryLabel = [[UILabel alloc] init];
  clearHistoryLabel.text = @"Clear history";
  clearHistoryLabel.textColor = [UIColor whiteColor];
  clearHistoryLabel.font = [UIFont systemFontOfSize:clearHistoryFontSize];
  clearHistoryLabel.translatesAutoresizingMaskIntoConstraints = NO;

  [clearHistoryButton addSubview:clearHistoryIcon];
  [clearHistoryButton addSubview:clearHistoryLabel];
  [contentContainer addSubview:clearHistoryButton];
  _clearHistoryButton = clearHistoryButton;

  // Add constraints for chevron down and clear history buttons
  [NSLayoutConstraint activateConstraints:@[
    [chevronDownButton.centerXAnchor constraintEqualToAnchor:contentContainer.centerXAnchor],
    [chevronDownButton.centerYAnchor constraintEqualToAnchor:contentContainer.centerYAnchor],
    [chevronDownButton.widthAnchor constraintEqualToConstant:buttonSize],
    [chevronDownButton.heightAnchor constraintEqualToConstant:buttonSize],

    [clearHistoryButton.trailingAnchor constraintEqualToAnchor:contentContainer.trailingAnchor constant:-sidePadding],
    [clearHistoryButton.centerYAnchor constraintEqualToAnchor:contentContainer.centerYAnchor],

    [clearHistoryIcon.leadingAnchor constraintEqualToAnchor:clearHistoryButton.leadingAnchor],
    [clearHistoryIcon.centerYAnchor constraintEqualToAnchor:clearHistoryButton.centerYAnchor],
    [clearHistoryIcon.widthAnchor constraintEqualToConstant:clearHistoryIconSize],
    [clearHistoryIcon.heightAnchor constraintEqualToConstant:clearHistoryIconSize],

    [clearHistoryLabel.leadingAnchor constraintEqualToAnchor:clearHistoryIcon.trailingAnchor constant:clearHistorySpacing],
    [clearHistoryLabel.trailingAnchor constraintEqualToAnchor:clearHistoryButton.trailingAnchor],
    [clearHistoryLabel.centerYAnchor constraintEqualToAnchor:clearHistoryButton.centerYAnchor],
  ]];
  
  _topBarView = topBar;
  return topBar;
}

- (void)updateForChatMode:(BOOL)isChatMode
{
  if (!_topBarView) {
    return;
  }
  
  [UIView animateWithDuration:0.25
                        delay:0
       usingSpringWithDamping:0.8
        initialSpringVelocity:0.5
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
                     if (isChatMode) {
                       if (self->_appNameLabel) {
                         self->_appNameLabel.alpha = 0.0;
                         self->_appNameLabel.hidden = YES;
                       }
                       if (self->_threeDotsButton) {
                         self->_threeDotsButton.alpha = 0.0;
                         self->_threeDotsButton.hidden = YES;
                       }
                       if (self->_refreshButton) {
                         self->_refreshButton.alpha = 0.0;
                         self->_refreshButton.hidden = YES;
                       }
                       if (self->_chevronDownButton) {
                         self->_chevronDownButton.alpha = 1.0;
                         self->_chevronDownButton.hidden = NO;
                       }
                       if (self->_clearHistoryButton) {
                         self->_clearHistoryButton.alpha = 1.0;
                         self->_clearHistoryButton.hidden = NO;
                       }
                     } else {
                       if (self->_appNameLabel) {
                         self->_appNameLabel.alpha = 1.0;
                         self->_appNameLabel.hidden = NO;
                       }
                       if (self->_threeDotsButton) {
                         self->_threeDotsButton.alpha = 1.0;
                         self->_threeDotsButton.hidden = NO;
                       }
                       if (self->_refreshButton) {
                         self->_refreshButton.alpha = 1.0;
                         self->_refreshButton.hidden = NO;
                       }
                       if (self->_chevronDownButton) {
                         self->_chevronDownButton.alpha = 0.0;
                         self->_chevronDownButton.hidden = YES;
                       }
                       if (self->_clearHistoryButton) {
                         self->_clearHistoryButton.alpha = 0.0;
                         self->_clearHistoryButton.hidden = YES;
                       }
                     }
                   }
                   completion:nil];
}

- (void)setAppName:(NSString *)appName
{
  if (_appNameLabel) {
    _appNameLabel.text = appName ?: @"App";
  }
}

- (void)fixPositioning
{
  if (!_topBarView || !_topBarView.superview) {
    return;
  }
  
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return;
  }
  
  [window layoutIfNeeded];
  if (window.rootViewController && window.rootViewController.view) {
    [window.rootViewController.view layoutIfNeeded];
  }
  [_topBarView.superview layoutIfNeeded];
  
  CGFloat safeAreaTop = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaTop = window.safeAreaInsets.top;
  }

  CGFloat topBarTopPadding = safeAreaTop + ([self isIPad] ? 14 : 10);
  CGFloat contentHeight = [self isIPad] ? 56 : 44;

  if (_topBarView.subviews.count > 0) {
    UIView *contentContainer = _topBarView.subviews[0];

    NSArray *constraints = _topBarView.constraints;
    for (NSLayoutConstraint *constraint in constraints) {
      if ((constraint.firstItem == contentContainer && constraint.firstAttribute == NSLayoutAttributeTop &&
           constraint.secondItem == _topBarView && constraint.secondAttribute == NSLayoutAttributeTop) ||
          (constraint.secondItem == contentContainer && constraint.secondAttribute == NSLayoutAttributeTop &&
           constraint.firstItem == _topBarView && constraint.firstAttribute == NSLayoutAttributeTop)) {
        constraint.constant = topBarTopPadding;
        break;
      }
    }

    for (NSLayoutConstraint *constraint in _topBarView.constraints) {
      if (constraint.firstItem == _topBarView && constraint.firstAttribute == NSLayoutAttributeHeight) {
        constraint.constant = contentHeight + topBarTopPadding;
        break;
      }
    }
  }
  
  [_topBarView.superview setNeedsLayout];
  [_topBarView.superview layoutIfNeeded];
}

#pragma mark - Button Actions

- (void)handleHomeButtonPress:(UIButton *)sender
{
  if ([self.delegate respondsToSelector:@selector(topBarHomeButtonPressed)]) {
    [self.delegate topBarHomeButtonPressed];
  }
}

- (void)handleRefreshButtonPress:(UIButton *)sender
{
  if ([self.delegate respondsToSelector:@selector(topBarRefreshButtonPressed)]) {
    [self.delegate topBarRefreshButtonPressed];
  }
}

- (void)handleToggleChat:(UIButton *)sender
{
  if ([self.delegate respondsToSelector:@selector(topBarChevronDownPressed)]) {
    [self.delegate topBarChevronDownPressed];
  }
}

@end

