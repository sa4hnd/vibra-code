// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAbstractLoader.h"
#import "EXAppViewController.h"
#import "EXChatBackendService.h"
#import "EXEnvBridge.h"
#import "EXKernel.h"
#import "EXManifests-Swift.h"
#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXRootViewController.h"
#import <AuthenticationServices/AuthenticationServices.h>

@import EXManifests;

@implementation EXPreviewZoomManager (TopBar)

#pragma mark - Top Bar Creation

- (UIView *)createTopBarView:(UIView *)superview {
  EXKernel *kernel = [EXKernel sharedInstance];
  EXKernelAppRecord *visibleApp = kernel.visibleApp;

  if (!visibleApp) {
    return nil;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return nil;
  }

  // Get safe area from the view controller's view (more accurate than window)
  CGFloat safeAreaTop = 0;
  if (@available(iOS 11.0, *)) {
    // Try to get from the superview first (most accurate)
    if ([superview respondsToSelector:@selector(safeAreaInsets)]) {
      safeAreaTop = [superview safeAreaInsets].top;
    }
    // Fallback to window if superview doesn't have safe area
    if (safeAreaTop == 0) {
      safeAreaTop = window.safeAreaInsets.top;
    }
  }

  // Add extra padding below status bar (move top bar down)
  CGFloat topBarTopPadding =
      safeAreaTop + 10; // 10pt extra padding below status bar

  // Create transparent top bar (no background - only button groups have
  // backgrounds)
  UIView *topBar = [[UIView alloc] init];
  topBar.backgroundColor = [UIColor clearColor];
  topBar.translatesAutoresizingMaskIntoConstraints = NO;

  // Get app name - prefer Convex database name, fallback to manifest name
  NSString *appName = self.appNameFromConvex ?: @"App";

  // If no Convex name set, try to get from manifest as fallback
  if ([appName isEqualToString:@"App"] && visibleApp &&
      visibleApp.appLoader.manifest) {
    @try {
      EXManifestsManifest *manifest = visibleApp.appLoader.manifest;
      NSDictionary *rawManifest = manifest.rawManifestJSON;

      // Try to get name from extra.expoClient.name (modern manifest format)
      if (rawManifest && [rawManifest isKindOfClass:[NSDictionary class]]) {
        NSDictionary *extra = rawManifest[@"extra"];
        if ([extra isKindOfClass:[NSDictionary class]]) {
          NSDictionary *expoClient = extra[@"expoClient"];
          if ([expoClient isKindOfClass:[NSDictionary class]]) {
            NSString *expoClientName = expoClient[@"name"];
            if ([expoClientName isKindOfClass:[NSString class]] &&
                expoClientName.length > 0) {
              appName = expoClientName;
            }
          }
        }

        // Fallback to top-level name property
        if ([appName isEqualToString:@"App"]) {
          NSString *manifestName = rawManifest[@"name"];
          if ([manifestName isKindOfClass:[NSString class]] &&
              manifestName.length > 0) {
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

  // Force layout pass to ensure safe area is calculated (critical for automatic
  // zoom)
  [superview setNeedsLayout];
  [superview layoutIfNeeded];

  // Recalculate safe area AFTER layout (ensures accurate value on automatic
  // zoom)
  if (@available(iOS 11.0, *)) {
    if ([superview respondsToSelector:@selector(safeAreaInsets)]) {
      CGFloat newSafeAreaTop = [superview safeAreaInsets].top;
      if (newSafeAreaTop > 0) {
        safeAreaTop = newSafeAreaTop;
        topBarTopPadding = safeAreaTop + 10;
      }
    }
  }

  // Create left button group (Home + Refresh) with glass background
  UIStackView *leftButtonGroup = [[UIStackView alloc] init];
  leftButtonGroup.axis = UILayoutConstraintAxisHorizontal;
  leftButtonGroup.spacing = 0;
  leftButtonGroup.translatesAutoresizingMaskIntoConstraints = NO;
  leftButtonGroup.layer.cornerRadius = 12;
  leftButtonGroup.clipsToBounds = YES;

  // Add glass background to left group
  UIVisualEffect *buttonGlassEffect = nil;
  if (@available(iOS 26.0, *)) {
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
        NSMethodSignature *signature =
            [glassEffectClass methodSignatureForSelector:effectSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:effectSelector];
        [invocation setTarget:glassEffectClass];
        NSInteger style = 0;
        [invocation setArgument:&style atIndex:2];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        buttonGlassEffect = (__bridge id)tempResult;

        // Set interactive property for responsive glass effect
        if (buttonGlassEffect &&
            [buttonGlassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig = [buttonGlassEffect
              methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation =
              [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:buttonGlassEffect];
          BOOL interactive = YES;
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }
      }
    }
    if (!buttonGlassEffect) {
      buttonGlassEffect =
          [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
    }
  } else {
    buttonGlassEffect =
        [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
  }

  UIVisualEffectView *leftGroupBackground =
      [[UIVisualEffectView alloc] initWithEffect:buttonGlassEffect];
  leftGroupBackground.layer.cornerRadius =
      18; // Half of height (36/2) for circular appearance
  leftGroupBackground.clipsToBounds = YES;
  leftGroupBackground.translatesAutoresizingMaskIntoConstraints = NO;
  [topBar addSubview:leftGroupBackground];
  self.leftGroupBackground = leftGroupBackground;

  // Home button
  UIButton *homeButton = [UIButton buttonWithType:UIButtonTypeSystem];
  homeButton.translatesAutoresizingMaskIntoConstraints = NO;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image =
        [UIImage systemImageNamed:@"house.fill"
                withConfiguration:
                    [UIImageSymbolConfiguration
                        configurationWithPointSize:18
                                            weight:UIImageSymbolWeightRegular]];
    config.baseForegroundColor = [UIColor whiteColor];
    homeButton.configuration = config;
  } else {
    [homeButton setImage:[UIImage systemImageNamed:@"house.fill"]
                forState:UIControlStateNormal];
    homeButton.tintColor = [UIColor whiteColor];
  }
  [homeButton addTarget:self
                 action:@selector(handleHomeButtonPress:)
       forControlEvents:UIControlEventTouchUpInside];
  [leftButtonGroup addArrangedSubview:homeButton];

  // Refresh button
  UIButton *refreshButton = [UIButton buttonWithType:UIButtonTypeSystem];
  refreshButton.translatesAutoresizingMaskIntoConstraints = NO;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image =
        [UIImage systemImageNamed:@"arrow.clockwise"
                withConfiguration:
                    [UIImageSymbolConfiguration
                        configurationWithPointSize:18
                                            weight:UIImageSymbolWeightRegular]];
    config.baseForegroundColor = [UIColor whiteColor];
    refreshButton.configuration = config;
  } else {
    [refreshButton setImage:[UIImage systemImageNamed:@"arrow.clockwise"]
                   forState:UIControlStateNormal];
    refreshButton.tintColor = [UIColor whiteColor];
  }
  [refreshButton addTarget:self
                    action:@selector(handleRefreshButtonPress:)
          forControlEvents:UIControlEventTouchUpInside];
  [leftButtonGroup addArrangedSubview:refreshButton];

  [leftGroupBackground.contentView addSubview:leftButtonGroup];

  // App name label (center, no background)
  self.appNameLabel = [[UILabel alloc] init];
  self.appNameLabel.text = appName;
  self.appNameLabel.textColor = [UIColor whiteColor];
  self.appNameLabel.font = [UIFont systemFontOfSize:17
                                             weight:UIFontWeightSemibold];
  self.appNameLabel.lineBreakMode = NSLineBreakByTruncatingTail;
  self.appNameLabel.textAlignment = NSTextAlignmentCenter;
  self.appNameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [topBar addSubview:self.appNameLabel];

  // GitHub button with glass background (between app name and three dots)
  UIVisualEffectView *githubGroupBackground =
      [[UIVisualEffectView alloc] initWithEffect:buttonGlassEffect];
  githubGroupBackground.layer.cornerRadius =
      18; // Half of height (36/2) for circular appearance
  githubGroupBackground.clipsToBounds = YES;
  githubGroupBackground.translatesAutoresizingMaskIntoConstraints = NO;
  [topBar addSubview:githubGroupBackground];
  self.githubGroupBackground = githubGroupBackground;

  UIButton *githubButton = [UIButton buttonWithType:UIButtonTypeSystem];
  githubButton.translatesAutoresizingMaskIntoConstraints = NO;
  // Use actual GitHub logo from assets (white version)
  UIImage *githubImage = [[UIImage imageNamed:@"GitHubIcon"] imageWithRenderingMode:UIImageRenderingModeAlwaysOriginal];
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image = githubImage;
    githubButton.configuration = config;
  } else {
    [githubButton setImage:githubImage forState:UIControlStateNormal];
  }
  [githubButton addTarget:self
                   action:@selector(handleGitHubButtonTapped:)
         forControlEvents:UIControlEventTouchUpInside];
  [githubGroupBackground.contentView addSubview:githubButton];
  self.githubButton = githubButton;

  // Right button group (Three dots) with glass background
  UIVisualEffectView *rightGroupBackground =
      [[UIVisualEffectView alloc] initWithEffect:buttonGlassEffect];
  rightGroupBackground.layer.cornerRadius =
      18; // Half of height (36/2) for circular appearance
  rightGroupBackground.clipsToBounds = YES;
  rightGroupBackground.translatesAutoresizingMaskIntoConstraints = NO;
  [topBar addSubview:rightGroupBackground];
  self.rightGroupBackground = rightGroupBackground;

  // Three dots button with native UIMenu
  UIButton *dotsButton = [UIButton buttonWithType:UIButtonTypeSystem];
  dotsButton.translatesAutoresizingMaskIntoConstraints = NO;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image =
        [UIImage systemImageNamed:@"ellipsis"
                withConfiguration:
                    [UIImageSymbolConfiguration
                        configurationWithPointSize:18
                                            weight:UIImageSymbolWeightRegular]];
    config.baseForegroundColor = [UIColor whiteColor];
    dotsButton.configuration = config;
  } else {
    [dotsButton setImage:[UIImage systemImageNamed:@"ellipsis"]
                forState:UIControlStateNormal];
    dotsButton.tintColor = [UIColor whiteColor];
  }

  // Add native UIMenu
  if (@available(iOS 14.0, *)) {
    // View Usage action - shows credits/tokens remaining
    UIAction *viewUsageAction =
        [UIAction actionWithTitle:@"View Usage"
                            image:[UIImage systemImageNamed:@"chart.bar.fill"]
                       identifier:nil
                          handler:^(__kindof UIAction *_Nonnull action) {
                            [self handleViewUsage];
                          }];

    // View Files action - opens the files modal
    UIAction *viewFilesAction =
        [UIAction actionWithTitle:@"View Files"
                            image:[UIImage systemImageNamed:@"folder"]
                       identifier:nil
                          handler:^(__kindof UIAction *_Nonnull action) {
                            [self showFilesModal];
                          }];

    // Restart Dev Server action - restarts the dev server if stuck
    UIAction *restartServerAction =
        [UIAction actionWithTitle:@"Restart Dev Server"
                            image:[UIImage systemImageNamed:@"arrow.clockwise.circle"]
                       identifier:nil
                          handler:^(__kindof UIAction *_Nonnull action) {
                            [self handleRestartDevServer];
                          }];

    // Share Project action - shares the project URL
    UIAction *shareProjectAction =
        [UIAction actionWithTitle:@"Share Project"
                            image:[UIImage systemImageNamed:@"square.and.arrow.up"]
                       identifier:nil
                          handler:^(__kindof UIAction *_Nonnull action) {
                            [self handleShareProject];
                          }];

    // Contact Support action - opens email or support page
    UIAction *contactSupportAction =
        [UIAction actionWithTitle:@"Contact Support"
                            image:[UIImage systemImageNamed:@"envelope"]
                       identifier:nil
                          handler:^(__kindof UIAction *_Nonnull action) {
                            [self handleContactSupport];
                          }];

    // About action - shows app info
    UIAction *aboutAction =
        [UIAction actionWithTitle:@"About VibraCoder"
                            image:[UIImage systemImageNamed:@"info.circle"]
                       identifier:nil
                          handler:^(__kindof UIAction *_Nonnull action) {
                            [self handleAbout];
                          }];

    UIMenu *menu = [UIMenu
        menuWithTitle:@""
             children:@[
               viewUsageAction, viewFilesAction, restartServerAction, shareProjectAction, contactSupportAction, aboutAction
             ]];

    // Make menu dark mode
    if (@available(iOS 15.0, *)) {
      menu = [menu menuByReplacingChildren:menu.children];
      dotsButton.menu = menu;
    } else {
      dotsButton.menu = menu;
    }

    dotsButton.showsMenuAsPrimaryAction = YES;
  }

  [rightGroupBackground.contentView addSubview:dotsButton];

  // Layout constraints
  [NSLayoutConstraint activateConstraints:@[
    // Left group background
    [leftGroupBackground.leadingAnchor
        constraintEqualToAnchor:topBar.leadingAnchor
                       constant:16],
    [leftGroupBackground.topAnchor constraintEqualToAnchor:topBar.topAnchor
                                                  constant:topBarTopPadding],
    [leftGroupBackground.heightAnchor constraintEqualToConstant:36],

    // Left button group inside background
    [leftButtonGroup.leadingAnchor
        constraintEqualToAnchor:leftGroupBackground.leadingAnchor],
    [leftButtonGroup.trailingAnchor
        constraintEqualToAnchor:leftGroupBackground.trailingAnchor],
    [leftButtonGroup.topAnchor
        constraintEqualToAnchor:leftGroupBackground.topAnchor],
    [leftButtonGroup.bottomAnchor
        constraintEqualToAnchor:leftGroupBackground.bottomAnchor],

    // Home button
    [homeButton.widthAnchor constraintEqualToConstant:44],
    [homeButton.heightAnchor constraintEqualToConstant:36],

    // Refresh button
    [refreshButton.widthAnchor constraintEqualToConstant:44],
    [refreshButton.heightAnchor constraintEqualToConstant:36],

    // GitHub button group background (left of right group)
    [githubGroupBackground.trailingAnchor
        constraintEqualToAnchor:rightGroupBackground.leadingAnchor
                       constant:-8],
    [githubGroupBackground.topAnchor constraintEqualToAnchor:topBar.topAnchor
                                                     constant:topBarTopPadding],
    [githubGroupBackground.widthAnchor constraintEqualToConstant:44],
    [githubGroupBackground.heightAnchor constraintEqualToConstant:36],

    // GitHub button inside background
    [githubButton.leadingAnchor
        constraintEqualToAnchor:githubGroupBackground.leadingAnchor],
    [githubButton.trailingAnchor
        constraintEqualToAnchor:githubGroupBackground.trailingAnchor],
    [githubButton.topAnchor
        constraintEqualToAnchor:githubGroupBackground.topAnchor],
    [githubButton.bottomAnchor
        constraintEqualToAnchor:githubGroupBackground.bottomAnchor],

    // Right group background
    [rightGroupBackground.trailingAnchor
        constraintEqualToAnchor:topBar.trailingAnchor
                       constant:-16],
    [rightGroupBackground.topAnchor constraintEqualToAnchor:topBar.topAnchor
                                                   constant:topBarTopPadding],
    [rightGroupBackground.widthAnchor constraintEqualToConstant:44],
    [rightGroupBackground.heightAnchor constraintEqualToConstant:36],

    // Dots button inside background
    [dotsButton.leadingAnchor
        constraintEqualToAnchor:rightGroupBackground.leadingAnchor],
    [dotsButton.trailingAnchor
        constraintEqualToAnchor:rightGroupBackground.trailingAnchor],
    [dotsButton.topAnchor
        constraintEqualToAnchor:rightGroupBackground.topAnchor],
    [dotsButton.bottomAnchor
        constraintEqualToAnchor:rightGroupBackground.bottomAnchor],

    // Top bar constraints to superview
    [topBar.leadingAnchor constraintEqualToAnchor:superview.leadingAnchor],
    [topBar.trailingAnchor constraintEqualToAnchor:superview.trailingAnchor],
    [topBar.topAnchor constraintEqualToAnchor:superview.topAnchor],
    [topBar.heightAnchor constraintEqualToConstant:44 + topBarTopPadding]
  ]];

  // App name label constraints (centered by default, moves left in chat mode)
  self.appNameCenterConstraint = [self.appNameLabel.centerXAnchor
      constraintEqualToAnchor:topBar.centerXAnchor];
  [NSLayoutConstraint activateConstraints:@[
    self.appNameCenterConstraint,
    [self.appNameLabel.centerYAnchor
        constraintEqualToAnchor:leftGroupBackground.centerYAnchor],
    // Add max width constraint to prevent overflow
    [self.appNameLabel.widthAnchor constraintLessThanOrEqualToConstant:200]
  ]];

  // Store references to buttons for dynamic updates
  self.threeDotsButton = dotsButton;
  self.refreshButton = refreshButton;

  // Add Clear history button with glass background (initially hidden, shown in
  // chat mode)
  UIVisualEffectView *clearHistoryBackground =
      [[UIVisualEffectView alloc] initWithEffect:buttonGlassEffect];
  clearHistoryBackground.layer.cornerRadius = 18;
  clearHistoryBackground.clipsToBounds = YES;
  clearHistoryBackground.translatesAutoresizingMaskIntoConstraints = NO;
  clearHistoryBackground.hidden = YES; // Initially hidden
  [topBar addSubview:clearHistoryBackground];

  UIButton *clearHistoryButton = [UIButton buttonWithType:UIButtonTypeSystem];
  clearHistoryButton.translatesAutoresizingMaskIntoConstraints = NO;

  // Create horizontal stack for text and icon
  UIImageSymbolConfiguration *clearHistoryIconConfig =
      [UIImageSymbolConfiguration
          configurationWithPointSize:16
                              weight:UIImageSymbolWeightRegular];
  UIImage *clearHistoryIconImage =
      [UIImage systemImageNamed:@"arrow.clockwise"
              withConfiguration:clearHistoryIconConfig];
  UIImageView *clearHistoryIcon =
      [[UIImageView alloc] initWithImage:clearHistoryIconImage];
  clearHistoryIcon.tintColor = [UIColor whiteColor];
  clearHistoryIcon.translatesAutoresizingMaskIntoConstraints = NO;

  UILabel *clearHistoryLabel = [[UILabel alloc] init];
  clearHistoryLabel.text = @"Clear history";
  clearHistoryLabel.textColor = [UIColor whiteColor];
  clearHistoryLabel.font = [UIFont systemFontOfSize:16];
  clearHistoryLabel.translatesAutoresizingMaskIntoConstraints = NO;

  [clearHistoryButton addSubview:clearHistoryIcon];
  [clearHistoryButton addSubview:clearHistoryLabel];
  [clearHistoryButton addTarget:self
                         action:@selector(handleClearHistoryButtonTapped:)
               forControlEvents:UIControlEventTouchUpInside];
  [clearHistoryBackground.contentView addSubview:clearHistoryButton];
  self.clearHistoryButton = clearHistoryButton;
  self.clearHistoryBackground = clearHistoryBackground;

  // Add constraints for Clear history background and button
  [NSLayoutConstraint activateConstraints:@[
    // Clear history background
    [clearHistoryBackground.trailingAnchor
        constraintEqualToAnchor:topBar.trailingAnchor
                       constant:-16],
    [clearHistoryBackground.topAnchor constraintEqualToAnchor:topBar.topAnchor
                                                     constant:topBarTopPadding],
    [clearHistoryBackground.heightAnchor constraintEqualToConstant:36],

    // Clear history button inside background
    [clearHistoryButton.leadingAnchor
        constraintEqualToAnchor:clearHistoryBackground.leadingAnchor
                       constant:8],
    [clearHistoryButton.trailingAnchor
        constraintEqualToAnchor:clearHistoryBackground.trailingAnchor
                       constant:-8],
    [clearHistoryButton.topAnchor
        constraintEqualToAnchor:clearHistoryBackground.topAnchor],
    [clearHistoryButton.bottomAnchor
        constraintEqualToAnchor:clearHistoryBackground.bottomAnchor],

    // Clear history icon
    [clearHistoryIcon.leadingAnchor
        constraintEqualToAnchor:clearHistoryButton.leadingAnchor],
    [clearHistoryIcon.centerYAnchor
        constraintEqualToAnchor:clearHistoryButton.centerYAnchor],
    [clearHistoryIcon.widthAnchor constraintEqualToConstant:16],
    [clearHistoryIcon.heightAnchor constraintEqualToConstant:16],

    // Clear history label
    [clearHistoryLabel.leadingAnchor
        constraintEqualToAnchor:clearHistoryIcon.trailingAnchor
                       constant:8],
    [clearHistoryLabel.trailingAnchor
        constraintEqualToAnchor:clearHistoryButton.trailingAnchor],
    [clearHistoryLabel.centerYAnchor
        constraintEqualToAnchor:clearHistoryButton.centerYAnchor],
  ]];

  // Add chevron down button for chat mode (initially hidden)
  UIVisualEffectView *chevronGroupBackground =
      [[UIVisualEffectView alloc] initWithEffect:buttonGlassEffect];
  chevronGroupBackground.layer.cornerRadius =
      18; // Half of height (36/2) for circular appearance
  chevronGroupBackground.clipsToBounds = YES;
  chevronGroupBackground.translatesAutoresizingMaskIntoConstraints = NO;
  chevronGroupBackground.hidden = YES; // Initially hidden
  [topBar addSubview:chevronGroupBackground];

  UIButton *chevronDownButton = [UIButton buttonWithType:UIButtonTypeSystem];
  chevronDownButton.translatesAutoresizingMaskIntoConstraints = NO;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image =
        [UIImage systemImageNamed:@"chevron.down"
                withConfiguration:
                    [UIImageSymbolConfiguration
                        configurationWithPointSize:18
                                            weight:UIImageSymbolWeightRegular]];
    config.baseForegroundColor = [UIColor whiteColor];
    chevronDownButton.configuration = config;
  } else {
    [chevronDownButton setImage:[UIImage systemImageNamed:@"chevron.down"]
                       forState:UIControlStateNormal];
    chevronDownButton.tintColor = [UIColor whiteColor];
  }
  [chevronDownButton addTarget:self
                        action:@selector(toggleChat)
              forControlEvents:UIControlEventTouchUpInside];
  [chevronGroupBackground.contentView addSubview:chevronDownButton];
  self.chevronDownButton = chevronDownButton;

  // Constraints for chevron down button group
  [NSLayoutConstraint activateConstraints:@[
    // Chevron group background (centered)
    [chevronGroupBackground.centerXAnchor
        constraintEqualToAnchor:topBar.centerXAnchor],
    [chevronGroupBackground.topAnchor constraintEqualToAnchor:topBar.topAnchor
                                                     constant:topBarTopPadding],
    [chevronGroupBackground.widthAnchor constraintEqualToConstant:44],
    [chevronGroupBackground.heightAnchor constraintEqualToConstant:36],

    // Chevron button inside background
    [chevronDownButton.leadingAnchor
        constraintEqualToAnchor:chevronGroupBackground.leadingAnchor],
    [chevronDownButton.trailingAnchor
        constraintEqualToAnchor:chevronGroupBackground.trailingAnchor],
    [chevronDownButton.topAnchor
        constraintEqualToAnchor:chevronGroupBackground.topAnchor],
    [chevronDownButton.bottomAnchor
        constraintEqualToAnchor:chevronGroupBackground.bottomAnchor],
  ]];

  // Store reference to chevron group background
  self.chevronGroupBackground = chevronGroupBackground;

  // Create trailing constraint for app name to prevent overflow under chevron in chat mode
  // This is initially inactive and activated when entering chat mode
  self.appNameTrailingConstraint = [self.appNameLabel.trailingAnchor
      constraintLessThanOrEqualToAnchor:chevronGroupBackground.leadingAnchor
                               constant:-16];
  self.appNameTrailingConstraint.active = NO; // Initially inactive

  return topBar;
}

- (void)updateTopBarForChatMode:(BOOL)isChatMode {
  if (!self.topBarView || !self.topBarView.superview) {
    return; // Top bar not created yet or already removed
  }

  // Capture strong reference to prevent deallocation during animation
  UIView *topBar = self.topBarView;

  // Animate the transition
  [UIView animateWithDuration:0.25
                        delay:0
       usingSpringWithDamping:0.8
        initialSpringVelocity:0.5
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
                     // Safety check: ensure topBar is still valid
                     if (!topBar.superview) {
                       return;
                     }
                     if (isChatMode) {
                       // Chat mode: Hide preview elements, show chat elements
                       // Keep app name visible but move to left
                       if (self.appNameCenterConstraint && self.appNameLabel && self.appNameLabel.superview) {
                         self.appNameCenterConstraint.active = NO;
                         if (!self.appNameLeftConstraint && topBar.superview) {
                           self.appNameLeftConstraint =
                               [self.appNameLabel.leadingAnchor
                                   constraintEqualToAnchor:topBar.leadingAnchor
                                                  constant:16];
                         }
                         if (self.appNameLeftConstraint) {
                           self.appNameLeftConstraint.active = YES;
                         }
                         // Activate trailing constraint to prevent overflow under chevron
                         if (self.appNameTrailingConstraint) {
                           self.appNameTrailingConstraint.active = YES;
                         }
                       }
                       if (self.threeDotsButton) {
                         self.threeDotsButton.alpha = 0.0;
                         self.threeDotsButton.hidden = YES;
                       }
                       if (self.refreshButton) {
                         self.refreshButton.alpha = 0.0;
                         self.refreshButton.hidden = YES;
                       }
                       // Hide button group backgrounds
                       if (self.leftGroupBackground) {
                         self.leftGroupBackground.alpha = 0.0;
                         self.leftGroupBackground.hidden = YES;
                       }
                       if (self.rightGroupBackground) {
                         self.rightGroupBackground.alpha = 0.0;
                         self.rightGroupBackground.hidden = YES;
                       }
                       // Hide GitHub button in chat mode
                       if (self.githubGroupBackground) {
                         self.githubGroupBackground.alpha = 0.0;
                         self.githubGroupBackground.hidden = YES;
                       }
                       if (self.githubButton) {
                         self.githubButton.alpha = 0.0;
                         self.githubButton.hidden = YES;
                       }
                       // Show chat mode elements
                       if (self.chevronGroupBackground) {
                         self.chevronGroupBackground.alpha = 1.0;
                         self.chevronGroupBackground.hidden = NO;
                       }
                       if (self.chevronDownButton) {
                         self.chevronDownButton.alpha = 1.0;
                         self.chevronDownButton.hidden = NO;
                       }
                       if (self.clearHistoryBackground) {
                         self.clearHistoryBackground.alpha = 1.0;
                         self.clearHistoryBackground.hidden = NO;
                       }
                       if (self.clearHistoryButton) {
                         self.clearHistoryButton.alpha = 1.0;
                         self.clearHistoryButton.hidden = NO;
                       }
                     } else {
                       // Preview mode: Show preview elements, hide chat
                       // elements
                       // Restore app name to center
                       if (self.appNameLeftConstraint) {
                         self.appNameLeftConstraint.active = NO;
                       }
                       // Deactivate trailing constraint when not in chat mode
                       if (self.appNameTrailingConstraint) {
                         self.appNameTrailingConstraint.active = NO;
                       }
                       if (self.appNameCenterConstraint) {
                         self.appNameCenterConstraint.active = YES;
                       }
                       if (self.appNameLabel) {
                         self.appNameLabel.alpha = 1.0;
                         self.appNameLabel.hidden = NO;
                       }
                       if (self.threeDotsButton) {
                         self.threeDotsButton.alpha = 1.0;
                         self.threeDotsButton.hidden = NO;
                       }
                       if (self.refreshButton) {
                         self.refreshButton.alpha = 1.0;
                         self.refreshButton.hidden = NO;
                       }
                       // Show button group backgrounds
                       if (self.leftGroupBackground) {
                         self.leftGroupBackground.alpha = 1.0;
                         self.leftGroupBackground.hidden = NO;
                       }
                       if (self.rightGroupBackground) {
                         self.rightGroupBackground.alpha = 1.0;
                         self.rightGroupBackground.hidden = NO;
                       }
                       // Show GitHub button in preview mode
                       if (self.githubGroupBackground) {
                         self.githubGroupBackground.alpha = 1.0;
                         self.githubGroupBackground.hidden = NO;
                       }
                       if (self.githubButton) {
                         self.githubButton.alpha = 1.0;
                         self.githubButton.hidden = NO;
                       }
                       // Hide chat mode elements
                       if (self.chevronGroupBackground) {
                         self.chevronGroupBackground.alpha = 0.0;
                         self.chevronGroupBackground.hidden = YES;
                       }
                       if (self.chevronDownButton) {
                         self.chevronDownButton.alpha = 0.0;
                         self.chevronDownButton.hidden = YES;
                       }
                       if (self.clearHistoryBackground) {
                         self.clearHistoryBackground.alpha = 0.0;
                         self.clearHistoryBackground.hidden = YES;
                       }
                       if (self.clearHistoryButton) {
                         self.clearHistoryButton.alpha = 0.0;
                         self.clearHistoryButton.hidden = YES;
                       }
                     }
                   }
                   completion:nil];
}

- (void)fixTopBarPositioning {
  // Recalculate and update top bar position to fix safe area issues
  if (!self.topBarView || !self.topBarView.superview) {
    return;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return;
  }

  // Force layout to ensure safe area insets are calculated correctly
  [window layoutIfNeeded];
  if (window.rootViewController && window.rootViewController.view) {
    [window.rootViewController.view layoutIfNeeded];
  }
  [self.topBarView.superview layoutIfNeeded];

  // Recalculate safe area
  CGFloat safeAreaTop = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaTop = window.safeAreaInsets.top;
  }

  CGFloat topBarTopPadding = safeAreaTop + 10;

  // Find the content container in the top bar and update its top constraint
  // The content container is the first subview of topBarView
  if (self.topBarView.subviews.count > 0) {
    UIView *contentContainer = self.topBarView.subviews[0];

    // Find constraint connecting contentContainer.topAnchor to
    // topBarView.topAnchor
    NSArray *constraints = self.topBarView.constraints;
    for (NSLayoutConstraint *constraint in constraints) {
      if ((constraint.firstItem == contentContainer &&
           constraint.firstAttribute == NSLayoutAttributeTop &&
           constraint.secondItem == self.topBarView &&
           constraint.secondAttribute == NSLayoutAttributeTop) ||
          (constraint.secondItem == contentContainer &&
           constraint.secondAttribute == NSLayoutAttributeTop &&
           constraint.firstItem == self.topBarView &&
           constraint.firstAttribute == NSLayoutAttributeTop)) {
        constraint.constant = topBarTopPadding;
        break;
      }
    }

    // Also update top bar height constraint if it exists
    for (NSLayoutConstraint *constraint in self.topBarView.constraints) {
      if (constraint.firstItem == self.topBarView &&
          constraint.firstAttribute == NSLayoutAttributeHeight) {
        constraint.constant = 44 + topBarTopPadding;
        break;
      }
    }
  }

  [self.topBarView.superview setNeedsLayout];
  [self.topBarView.superview layoutIfNeeded];
}

- (void)setAppName:(NSString *)appName {
  self.appNameFromConvex = appName;
  // Update label if it exists
  if (self.appNameLabel) {
    self.appNameLabel.text = appName ?: @"App";
  }
}

- (void)handleHomeButtonPress:(UIButton *)sender {
  // Go to home - same as DevMenuTopActions onGoToHome
  EXKernel *kernel = [EXKernel sharedInstance];
  if (kernel.browserController) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [kernel.browserController moveHomeToVisible];
    });
  }
}

- (void)handleRefreshButtonPress:(UIButton *)sender {
  NSLog(@"🔵 [TopBar] Refresh button pressed - isZoomed: %@", self.isZoomed ? @"YES" : @"NO");

  // If zoomed out, set flag to re-zoom after reload completes
  // This prevents the flash to full-screen during reload
  if (self.isZoomed) {
    self.needsZoomAfterReload = YES;
    NSLog(@"🔵 [TopBar] Set needsZoomAfterReload = YES");
  }

  // Reload app - same as DevMenuTopActions onAppReload
  EXKernel *kernel = [EXKernel sharedInstance];
  [kernel reloadVisibleApp];
}

- (void)handleClearHistoryButtonTapped:(UIButton *)sender {
  // Show native iOS confirmation alert
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"Clear History"
                       message:@"Are you sure you want to clear all chat history? This will start a fresh AI session."
                preferredStyle:UIAlertControllerStyleAlert];

  // Cancel action
  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                            style:UIAlertActionStyleCancel
                                          handler:nil]];

  // Confirm action - destructive style (red text)
  [alert addAction:[UIAlertAction actionWithTitle:@"Clear"
                                            style:UIAlertActionStyleDestructive
                                          handler:^(UIAlertAction * _Nonnull action) {
    [self performClearHistory];
  }]];

  // Present the alert
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

- (void)performClearHistory {
  // Guard: need session ID
  if (!self.chatSessionId || self.chatSessionId.length == 0) {
    NSLog(@"⚠️ [ClearHistory] No session ID available");
    return;
  }

  NSLog(@"🗑️ [ClearHistory] Starting clear history for session: %@", self.chatSessionId);

  // Call backend to clear messages
  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];

  [backendService clearMessagesForSession:self.chatSessionId
                               completion:^(NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        NSLog(@"❌ [ClearHistory] Error clearing messages: %@", error);

        // Show error alert
        UIAlertController *errorAlert = [UIAlertController
            alertControllerWithTitle:@"Error"
                             message:@"Failed to clear history. Please try again."
                      preferredStyle:UIAlertControllerStyleAlert];
        [errorAlert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                       style:UIAlertActionStyleDefault
                                                     handler:nil]];

        UIWindow *window = [UIApplication sharedApplication].keyWindow;
        UIViewController *rootVC = window.rootViewController;
        while (rootVC.presentedViewController) {
          rootVC = rootVC.presentedViewController;
        }
        [rootVC presentViewController:errorAlert animated:YES completion:nil];
        return;
      }

      NSLog(@"✅ [ClearHistory] Messages cleared from database");

      // Clear local state
      self.chatMessages = @[];
      self.displayedMessageCount = 0;

      // Clear message view caches
      if (self.messageViewCache) {
        [self.messageViewCache removeAllObjects];
      }
      if (self.visibleMessageIds) {
        [self.visibleMessageIds removeAllObjects];
      }
      if (self.messageHeightCache) {
        [self.messageHeightCache removeAllObjects];
      }

      // Remove status container if present
      if (self.statusContainer) {
        [self.statusContainer removeFromSuperview];
        self.statusContainer = nil;
      }
      self.statusContainerTopConstraint = nil;

      // Refresh the chat UI to show empty state
      [self refreshChatMessagesView];

      NSLog(@"✅ [ClearHistory] UI cleared successfully - next message will start fresh AI session");
    });
  }];
}

- (void)handleShareProject {
  // Get the project URL from the tunnel URL or construct it
  NSString *projectUrl = nil;

  // Try to get tunnel URL from the manager
  if (self.tunnelUrl && self.tunnelUrl.length > 0) {
    projectUrl = self.tunnelUrl;
  } else if (self.chatSessionId && self.chatSessionId.length > 0) {
    // Construct a shareable URL using the session ID
    projectUrl = [NSString stringWithFormat:@"%@/project/%@", [EXEnvBridge v0ApiUrl], self.chatSessionId];
  } else {
    // Fallback to app store URL
    projectUrl = [EXEnvBridge v0ApiUrl];
  }

  // Create share items
  NSString *shareText = [NSString stringWithFormat:@"Check out my app created with VibraCoder!"];
  NSURL *url = [NSURL URLWithString:projectUrl];

  NSArray *activityItems = url ? @[shareText, url] : @[shareText];

  UIActivityViewController *activityVC = [[UIActivityViewController alloc]
      initWithActivityItems:activityItems
      applicationActivities:nil];

  // Excluded activity types (optional)
  activityVC.excludedActivityTypes = @[
    UIActivityTypeAddToReadingList,
    UIActivityTypeAssignToContact
  ];

  // Present the share sheet
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }

  // For iPad, set the popover presentation
  if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
    activityVC.popoverPresentationController.sourceView = self.threeDotsButton;
    activityVC.popoverPresentationController.sourceRect = self.threeDotsButton.bounds;
  }

  [rootVC presentViewController:activityVC animated:YES completion:nil];
}

- (void)handleContactSupport {
  // Support email
  NSString *email = @"support@vibracodeapp.com";
  NSString *subject = @"VibraCoder Support Request";
  NSString *body = @"Please describe your issue or feedback:\n\n";

  // Try to open email client
  NSString *mailURLString = [NSString stringWithFormat:@"mailto:%@?subject=%@&body=%@",
      email,
      [subject stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]],
      [body stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]]];

  NSURL *mailURL = [NSURL URLWithString:mailURLString];

  if ([[UIApplication sharedApplication] canOpenURL:mailURL]) {
    [[UIApplication sharedApplication] openURL:mailURL options:@{} completionHandler:nil];
  } else {
    // Fallback: show alert with support info
    UIAlertController *alert = [UIAlertController
        alertControllerWithTitle:@"Contact Support"
                         message:[NSString stringWithFormat:@"Email us at:\n%@\n\nOr visit our website:\nvibracodeapp.com/support", email]
                  preferredStyle:UIAlertControllerStyleAlert];

    [alert addAction:[UIAlertAction actionWithTitle:@"Copy Email"
                                              style:UIAlertActionStyleDefault
                                            handler:^(UIAlertAction *action) {
                                              [UIPasteboard generalPasteboard].string = email;
                                            }]];

    [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                              style:UIAlertActionStyleCancel
                                            handler:nil]];

    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    UIViewController *rootVC = window.rootViewController;
    while (rootVC.presentedViewController) {
      rootVC = rootVC.presentedViewController;
    }
    [rootVC presentViewController:alert animated:YES completion:nil];
  }
}

- (void)handleAbout {
  // Get app version info
  NSString *appVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"1.0";
  NSString *buildNumber = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"] ?: @"1";

  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"VibraCoder"
                       message:[NSString stringWithFormat:@"Version %@ (%@)\n\nBuild apps with AI.\nJust describe what you want and watch it come to life.\n\n© 2025 VibraCoder", appVersion, buildNumber]
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Visit Website"
                                            style:UIAlertActionStyleDefault
                                          handler:^(UIAlertAction *action) {
                                            NSURL *url = [NSURL URLWithString:[EXEnvBridge v0ApiUrl]];
                                            [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
                                          }]];

  [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                            style:UIAlertActionStyleCancel
                                          handler:nil]];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

- (void)handleViewUsage {
  // Get clerkId from session
  NSString *clerkId = self.chatSession[@"createdBy"];

  if (!clerkId || clerkId.length == 0) {
    // Show alert with no usage data available
    UIAlertController *alert = [UIAlertController
        alertControllerWithTitle:@"Usage"
                         message:@"Unable to load usage data. Please open the chat first."
                  preferredStyle:UIAlertControllerStyleAlert];

    [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                              style:UIAlertActionStyleCancel
                                            handler:nil]];

    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    UIViewController *rootVC = window.rootViewController;
    while (rootVC.presentedViewController) {
      rootVC = rootVC.presentedViewController;
    }
    [rootVC presentViewController:alert animated:YES completion:nil];
    return;
  }

  // Show loading alert
  UIAlertController *loadingAlert = [UIAlertController
      alertControllerWithTitle:@"Loading..."
                       message:@"Fetching usage data"
                preferredStyle:UIAlertControllerStyleAlert];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:loadingAlert animated:YES completion:nil];

  // Fetch usage data from backend
  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService getUsageForClerkId:clerkId
                          completion:^(NSDictionary * _Nullable usage, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      // Dismiss loading alert
      [loadingAlert dismissViewControllerAnimated:YES completion:^{
        if (error || !usage) {
          // Show error
          UIAlertController *errorAlert = [UIAlertController
              alertControllerWithTitle:@"Error"
                               message:@"Failed to load usage data. Please try again."
                        preferredStyle:UIAlertControllerStyleAlert];

          [errorAlert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                        style:UIAlertActionStyleCancel
                                                      handler:nil]];

          UIWindow *window = [UIApplication sharedApplication].keyWindow;
          UIViewController *rootVC = window.rootViewController;
          while (rootVC.presentedViewController) {
            rootVC = rootVC.presentedViewController;
          }
          [rootVC presentViewController:errorAlert animated:YES completion:nil];
          return;
        }

        // Parse usage data
        NSString *billingMode = usage[@"billingMode"] ?: @"tokens";
        BOOL isCreditsMode = [billingMode isEqualToString:@"credits"];

        NSNumber *remainingNum = usage[@"remaining"];
        NSNumber *usedNum = usage[@"used"];
        NSNumber *totalNum = usage[@"total"];
        NSString *planName = usage[@"planName"] ?: @"Free";
        BOOL isPro = [usage[@"isPro"] boolValue];

        double remaining = remainingNum ? [remainingNum doubleValue] : 0;
        double used = usedNum ? [usedNum doubleValue] : 0;
        double total = totalNum ? [totalNum doubleValue] : 0;

        // Format values
        NSString *remainingStr = isCreditsMode
          ? [NSString stringWithFormat:@"$%.2f", remaining]
          : [NSString stringWithFormat:@"%.0f", remaining];

        NSString *usedStr = isCreditsMode
          ? [NSString stringWithFormat:@"$%.2f", used]
          : [NSString stringWithFormat:@"%.0f", used];

        NSString *totalStr = isCreditsMode
          ? [NSString stringWithFormat:@"$%.2f", total]
          : [NSString stringWithFormat:@"%.0f", total];

        NSString *unitLabel = isCreditsMode ? @"credits" : @"messages";

        // Calculate percentage
        double usagePercentage = total > 0 ? (used / total) * 100 : 0;

        // Build message
        NSString *message = [NSString stringWithFormat:
            @"Plan: %@\n\n"
            @"%@ %@ remaining\n"
            @"%@ used of %@ total\n\n"
            @"%.0f%% of your %@ used",
            planName,
            remainingStr, unitLabel,
            usedStr, totalStr,
            usagePercentage, unitLabel];

        // Show usage alert
        UIAlertController *usageAlert = [UIAlertController
            alertControllerWithTitle:@"📊 Usage"
                             message:message
                      preferredStyle:UIAlertControllerStyleAlert];

        if (!isPro) {
          [usageAlert addAction:[UIAlertAction actionWithTitle:@"Upgrade"
                                                        style:UIAlertActionStyleDefault
                                                      handler:^(UIAlertAction *action) {
            // Post notification to open upgrade screen
            [[NSNotificationCenter defaultCenter] postNotificationName:@"OpenUpgradeScreen" object:nil];
          }]];
        }

        [usageAlert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                      style:UIAlertActionStyleCancel
                                                    handler:nil]];

        UIWindow *window = [UIApplication sharedApplication].keyWindow;
        UIViewController *rootVC = window.rootViewController;
        while (rootVC.presentedViewController) {
          rootVC = rootVC.presentedViewController;
        }
        [rootVC presentViewController:usageAlert animated:YES completion:nil];
      }];
    });
  }];
}

- (void)handleRestartDevServer {
  // Show confirmation alert
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"Restart Dev Server"
                       message:@"If your app is stuck, frozen, or showing errors, restarting the development server might help.\n\nThis may take up to a minute."
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                            style:UIAlertActionStyleCancel
                                          handler:nil]];

  [alert addAction:[UIAlertAction actionWithTitle:@"Restart"
                                            style:UIAlertActionStyleDefault
                                          handler:^(UIAlertAction * _Nonnull action) {
    [self performRestartDevServer];
  }]];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

- (void)performRestartDevServer {
  // Get session ID - try chatSession.sessionId first, then fall back to chatSessionId
  NSString *sessionIdToUse = self.chatSession[@"sessionId"];
  if (!sessionIdToUse || sessionIdToUse.length == 0) {
    sessionIdToUse = self.chatSessionId;
  }

  if (!sessionIdToUse || sessionIdToUse.length == 0) {
    NSLog(@"⚠️ [RestartServer] No session ID available");
    UIAlertController *errorAlert = [UIAlertController
        alertControllerWithTitle:@"Error"
                         message:@"Unable to restart server. No session found."
                  preferredStyle:UIAlertControllerStyleAlert];
    [errorAlert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                   style:UIAlertActionStyleDefault
                                                 handler:nil]];
    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    UIViewController *rootVC = window.rootViewController;
    while (rootVC.presentedViewController) {
      rootVC = rootVC.presentedViewController;
    }
    [rootVC presentViewController:errorAlert animated:YES completion:nil];
    return;
  }

  NSLog(@"🔄 [RestartServer] Starting restart for session: %@", sessionIdToUse);

  // Show loading alert
  UIAlertController *loadingAlert = [UIAlertController
      alertControllerWithTitle:@"Restarting..."
                       message:@"This may take up to a minute"
                preferredStyle:UIAlertControllerStyleAlert];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:loadingAlert animated:YES completion:nil];

  // Call backend to restart server
  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService restartDevServerForSession:sessionIdToUse
                                  completion:^(NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [loadingAlert dismissViewControllerAnimated:YES completion:^{
        if (error) {
          NSLog(@"❌ [RestartServer] Error: %@", error);
          UIAlertController *errorAlert = [UIAlertController
              alertControllerWithTitle:@"Error"
                               message:@"Failed to restart server. Please try again."
                        preferredStyle:UIAlertControllerStyleAlert];
          [errorAlert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                         style:UIAlertActionStyleDefault
                                                       handler:nil]];

          UIWindow *window = [UIApplication sharedApplication].keyWindow;
          UIViewController *rootVC = window.rootViewController;
          while (rootVC.presentedViewController) {
            rootVC = rootVC.presentedViewController;
          }
          [rootVC presentViewController:errorAlert animated:YES completion:nil];
        } else {
          NSLog(@"✅ [RestartServer] Server restarted successfully");
          UIAlertController *successAlert = [UIAlertController
              alertControllerWithTitle:@"Server Restarted"
                               message:@"The development server has been restarted. Your app should reload automatically."
                        preferredStyle:UIAlertControllerStyleAlert];
          [successAlert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                           style:UIAlertActionStyleDefault
                                                         handler:nil]];

          UIWindow *window = [UIApplication sharedApplication].keyWindow;
          UIViewController *rootVC = window.rootViewController;
          while (rootVC.presentedViewController) {
            rootVC = rootVC.presentedViewController;
          }
          [rootVC presentViewController:successAlert animated:YES completion:nil];
        }
      }];
    });
  }];
}

#pragma mark - GitHub Integration

- (void)handleGitHubButtonTapped:(UIButton *)sender {
  NSLog(@"🐙 [GitHub] Button tapped");

  // Get clerkId from session
  NSString *clerkId = self.chatSession[@"createdBy"];

  if (!clerkId || clerkId.length == 0) {
    [self showGitHubError:@"Unable to check subscription status. Please open the chat first."];
    return;
  }

  // First check if user is Pro
  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService getUsageForClerkId:clerkId
                          completion:^(NSDictionary * _Nullable usage, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        NSLog(@"⚠️ [GitHub] Failed to check plan status, allowing access: %@", error);
        [self checkGitHubConnectionAndShowActionSheet];
        return;
      }

      BOOL isPro = [usage[@"isPro"] boolValue];

      if (!isPro) {
        [self showGitHubUpgradeRequired];
        return;
      }

      [self checkGitHubConnectionAndShowActionSheet];
    });
  }];
}

- (void)showGitHubUpgradeRequired {
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"Pro Feature"
                       message:@"GitHub integration is available for Pro subscribers.\n\nPlease go to Home → Profile to upgrade your plan."
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Upgrade"
                                            style:UIAlertActionStyleDefault
                                          handler:^(UIAlertAction *action) {
    [[NSNotificationCenter defaultCenter] postNotificationName:@"OpenUpgradeScreen" object:nil];
  }]];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                            style:UIAlertActionStyleCancel
                                          handler:nil]];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

- (void)checkGitHubConnectionAndShowActionSheet {
  NSString *clerkId = self.chatSession[@"createdBy"];

  if (!clerkId) {
    [self showGitHubActionSheetForDisconnectedState];
    return;
  }

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];

  [backendService checkGitHubConnectionForClerkId:clerkId
                                       completion:^(BOOL isConnected, NSString * _Nullable username, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      self.isGitHubConnected = isConnected;
      self.githubUsername = username;

      if (!isConnected) {
        [self showGitHubActionSheetForDisconnectedState];
        return;
      }

      NSString *convexId = self.chatSessionId;
      if (!convexId) {
        [self showGitHubActionSheetForConnectedState:username];
        return;
      }

      [backendService getGitHubStatusForSession:convexId
                                     completion:^(NSDictionary * _Nullable status, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          // Safely extract values, handling NSNull from JSON
          id repositoryValue = status[@"githubRepository"];
          id repositoryUrlValue = status[@"githubRepositoryUrl"];
          id pushStatusValue = status[@"githubPushStatus"];

          NSString *repository = (repositoryValue && ![repositoryValue isKindOfClass:[NSNull class]]) ? repositoryValue : nil;
          NSString *repositoryUrl = (repositoryUrlValue && ![repositoryUrlValue isKindOfClass:[NSNull class]]) ? repositoryUrlValue : nil;
          NSString *pushStatus = (pushStatusValue && ![pushStatusValue isKindOfClass:[NSNull class]]) ? pushStatusValue : nil;

          self.githubRepository = repository;
          self.githubRepositoryUrl = repositoryUrl;
          self.githubPushStatus = pushStatus;

          if (repository && repository.length > 0) {
            [self showGitHubActionSheetForRepoState:username repository:repository repositoryUrl:repositoryUrl pushStatus:pushStatus];
          } else {
            [self showGitHubActionSheetForConnectedState:username];
          }
        });
      }];
    });
  }];
}

- (void)showGitHubActionSheetForDisconnectedState {
  UIAlertController *actionSheet = [UIAlertController
      alertControllerWithTitle:@"GitHub"
                       message:@"Push your app to a GitHub repository"
                preferredStyle:UIAlertControllerStyleActionSheet];

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Connect GitHub"
                style:UIAlertActionStyleDefault
              handler:^(UIAlertAction *action) {
    [self startGitHubOAuth];
  }]];

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Cancel"
                style:UIAlertActionStyleCancel
              handler:nil]];

  if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
    actionSheet.popoverPresentationController.sourceView = self.githubButton;
    actionSheet.popoverPresentationController.sourceRect = self.githubButton.bounds;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:actionSheet animated:YES completion:nil];
}

- (void)showGitHubActionSheetForConnectedState:(NSString *)username {
  NSString *message = [NSString stringWithFormat:@"Connected as @%@\n\nCreate a repository to push your code.", username];

  UIAlertController *actionSheet = [UIAlertController
      alertControllerWithTitle:@"GitHub"
                       message:message
                preferredStyle:UIAlertControllerStyleActionSheet];

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Create & Push Repository"
                style:UIAlertActionStyleDefault
              handler:^(UIAlertAction *action) {
    [self showCreateRepoDialog];
  }]];

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Disconnect GitHub"
                style:UIAlertActionStyleDestructive
              handler:^(UIAlertAction *action) {
    [self disconnectGitHub];
  }]];

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Cancel"
                style:UIAlertActionStyleCancel
              handler:nil]];

  if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
    actionSheet.popoverPresentationController.sourceView = self.githubButton;
    actionSheet.popoverPresentationController.sourceRect = self.githubButton.bounds;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:actionSheet animated:YES completion:nil];
}

- (void)showGitHubActionSheetForRepoState:(NSString *)username repository:(NSString *)repository repositoryUrl:(NSString *)repositoryUrl pushStatus:(NSString *)pushStatus {
  NSString *statusText = @"Ready to sync";
  if ([pushStatus isEqualToString:@"in_progress"]) {
    statusText = @"Pushing...";
  } else if ([pushStatus isEqualToString:@"completed"]) {
    statusText = @"Synced";
  } else if ([pushStatus isEqualToString:@"failed"]) {
    statusText = @"Push failed";
  }

  NSString *repoName = [[repository componentsSeparatedByString:@"/"] lastObject];
  NSString *message = [NSString stringWithFormat:@"Repository: %@\nStatus: %@\n\nConnected as @%@", repoName, statusText, username];

  UIAlertController *actionSheet = [UIAlertController
      alertControllerWithTitle:@"GitHub"
                       message:message
                preferredStyle:UIAlertControllerStyleActionSheet];

  if (repositoryUrl && repositoryUrl.length > 0) {
    [actionSheet addAction:[UIAlertAction
        actionWithTitle:@"View on GitHub"
                  style:UIAlertActionStyleDefault
                handler:^(UIAlertAction *action) {
      NSURL *url = [NSURL URLWithString:repositoryUrl];
      if (url) {
        [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
      }
    }]];
  }

  if (![pushStatus isEqualToString:@"in_progress"]) {
    [actionSheet addAction:[UIAlertAction
        actionWithTitle:@"Push Changes"
                  style:UIAlertActionStyleDefault
                handler:^(UIAlertAction *action) {
      [self pushToExistingRepo];
    }]];
  }

  if ([pushStatus isEqualToString:@"failed"]) {
    [actionSheet addAction:[UIAlertAction
        actionWithTitle:@"Retry Push"
                  style:UIAlertActionStyleDefault
                handler:^(UIAlertAction *action) {
      [self retryGitHubPush];
    }]];
  }

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Disconnect GitHub"
                style:UIAlertActionStyleDestructive
              handler:^(UIAlertAction *action) {
    [self disconnectGitHub];
  }]];

  [actionSheet addAction:[UIAlertAction
      actionWithTitle:@"Cancel"
                style:UIAlertActionStyleCancel
              handler:nil]];

  if (UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad) {
    actionSheet.popoverPresentationController.sourceView = self.githubButton;
    actionSheet.popoverPresentationController.sourceRect = self.githubButton.bounds;
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:actionSheet animated:YES completion:nil];
}

- (void)showCreateRepoDialog {
  NSString *appName = self.appNameFromConvex ?: @"my-app";
  NSString *defaultRepoName = [[appName lowercaseString] stringByReplacingOccurrencesOfString:@" " withString:@"-"];
  NSCharacterSet *allowedChars = [NSCharacterSet characterSetWithCharactersInString:@"abcdefghijklmnopqrstuvwxyz0123456789-"];
  defaultRepoName = [[defaultRepoName componentsSeparatedByCharactersInSet:[allowedChars invertedSet]] componentsJoinedByString:@""];

  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"Create Repository"
                       message:@"Enter a name for your new GitHub repository"
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addTextFieldWithConfigurationHandler:^(UITextField *textField) {
    textField.placeholder = @"Repository name";
    textField.text = defaultRepoName;
    textField.autocapitalizationType = UITextAutocapitalizationTypeNone;
    textField.autocorrectionType = UITextAutocorrectionTypeNo;
  }];

  [alert addAction:[UIAlertAction
      actionWithTitle:@"Private Repository"
                style:UIAlertActionStyleDefault
              handler:^(UIAlertAction *action) {
    NSString *repoName = alert.textFields.firstObject.text;
    if (repoName.length > 0) {
      [self createAndPushRepo:repoName isPrivate:YES];
    }
  }]];

  [alert addAction:[UIAlertAction
      actionWithTitle:@"Public Repository"
                style:UIAlertActionStyleDefault
              handler:^(UIAlertAction *action) {
    NSString *repoName = alert.textFields.firstObject.text;
    if (repoName.length > 0) {
      [self createAndPushRepo:repoName isPrivate:NO];
    }
  }]];

  [alert addAction:[UIAlertAction
      actionWithTitle:@"Cancel"
                style:UIAlertActionStyleCancel
              handler:nil]];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

- (void)createAndPushRepo:(NSString *)repoName isPrivate:(BOOL)isPrivate {
  NSString *clerkId = self.chatSession[@"createdBy"];
  NSString *sessionId = self.sandboxId;
  NSString *convexId = self.chatSessionId;

  if (!clerkId || !sessionId || !convexId) {
    [self showGitHubError:@"Missing session information. Please try again."];
    return;
  }

  self.isGitHubActionInProgress = YES;
  [self updateGitHubButtonStatusIndicator];

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService createAndPushToGitHubWithSessionId:sessionId
                                            convexId:convexId
                                            repoName:repoName
                                           isPrivate:isPrivate
                                             clerkId:clerkId
                                          completion:^(BOOL success, NSString * _Nullable repository, NSString * _Nullable repositoryUrl, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      self.isGitHubActionInProgress = NO;

      if (error || !success) {
        [self showGitHubError:error.localizedDescription ?: @"Failed to create repository"];
        [self updateGitHubButtonStatusIndicator];
        return;
      }

      self.githubRepository = repository;
      self.githubRepositoryUrl = repositoryUrl;
      self.githubPushStatus = @"in_progress";
      [self updateGitHubButtonStatusIndicator];
      [self startGitHubStatusPolling];

      UIAlertController *alert = [UIAlertController
          alertControllerWithTitle:@"Repository Created"
                           message:[NSString stringWithFormat:@"Pushing code to %@...", repository]
                    preferredStyle:UIAlertControllerStyleAlert];
      [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];

      UIWindow *window = [UIApplication sharedApplication].keyWindow;
      UIViewController *rootVC = window.rootViewController;
      while (rootVC.presentedViewController) {
        rootVC = rootVC.presentedViewController;
      }
      [rootVC presentViewController:alert animated:YES completion:nil];
    });
  }];
}

- (void)pushToExistingRepo {
  if (!self.githubRepository) return;

  NSString *clerkId = self.chatSession[@"createdBy"];
  NSString *sessionId = self.sandboxId;
  NSString *convexId = self.chatSessionId;

  if (!clerkId || !sessionId || !convexId) {
    [self showGitHubError:@"Missing session information. Please try again."];
    return;
  }

  self.isGitHubActionInProgress = YES;
  self.githubPushStatus = @"in_progress";
  [self updateGitHubButtonStatusIndicator];

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService retryGitHubPushWithSessionId:sessionId
                                      convexId:convexId
                                    repository:self.githubRepository
                                       clerkId:clerkId
                                    completion:^(NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      self.isGitHubActionInProgress = NO;

      if (error) {
        self.githubPushStatus = @"failed";
        [self showGitHubError:error.localizedDescription];
        [self updateGitHubButtonStatusIndicator];
        return;
      }

      [self startGitHubStatusPolling];
    });
  }];
}

- (void)retryGitHubPush {
  [self pushToExistingRepo];
}

- (void)disconnectGitHub {
  NSString *clerkId = self.chatSession[@"createdBy"];
  if (!clerkId) return;

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService disconnectGitHubForClerkId:clerkId
                                  completion:^(NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        [self showGitHubError:error.localizedDescription];
        return;
      }

      self.isGitHubConnected = NO;
      self.githubUsername = nil;
      self.githubRepository = nil;
      self.githubRepositoryUrl = nil;
      self.githubPushStatus = nil;
      [self updateGitHubButtonStatusIndicator];

      UIAlertController *alert = [UIAlertController
          alertControllerWithTitle:@"Disconnected"
                           message:@"GitHub has been disconnected."
                    preferredStyle:UIAlertControllerStyleAlert];
      [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];

      UIWindow *window = [UIApplication sharedApplication].keyWindow;
      UIViewController *rootVC = window.rootViewController;
      while (rootVC.presentedViewController) {
        rootVC = rootVC.presentedViewController;
      }
      [rootVC presentViewController:alert animated:YES completion:nil];
    });
  }];
}

- (void)startGitHubOAuth {
  NSLog(@"🔐 [GitHub] Starting OAuth flow");

  NSString *clientId = @"YOUR_GITHUB_OAUTH_CLIENT_ID"; // Replace with your GitHub OAuth App Client ID
  NSString *redirectUri = @"vibracoder://github-callback";
  NSString *scope = @"repo%20read:user";
  NSString *state = [[NSUUID UUID] UUIDString];

  NSString *authUrlString = [NSString stringWithFormat:
      @"https://github.com/login/oauth/authorize?client_id=%@&redirect_uri=%@&scope=%@&state=%@",
      clientId, redirectUri, scope, state];

  NSURL *authUrl = [NSURL URLWithString:authUrlString];

  if (@available(iOS 12.0, *)) {
    ASWebAuthenticationSession *authSession = [[ASWebAuthenticationSession alloc]
        initWithURL:authUrl
        callbackURLScheme:@"vibracoder"
        completionHandler:^(NSURL * _Nullable callbackURL, NSError * _Nullable error) {
          // Clear the retained session
          self.githubAuthSession = nil;

          if (error) {
            NSLog(@"❌ [GitHub] OAuth error: %@", error);
            if (error.code != ASWebAuthenticationSessionErrorCodeCanceledLogin) {
              dispatch_async(dispatch_get_main_queue(), ^{
                [self showGitHubError:@"Authentication was cancelled"];
              });
            }
            return;
          }

          if (callbackURL) {
            NSLog(@"✅ [GitHub] OAuth callback: %@", callbackURL);

            NSURLComponents *components = [NSURLComponents componentsWithURL:callbackURL resolvingAgainstBaseURL:NO];
            NSString *code = nil;
            for (NSURLQueryItem *item in components.queryItems) {
              if ([item.name isEqualToString:@"code"]) {
                code = item.value;
                break;
              }
            }

            if (code) {
              [self exchangeGitHubCodeForToken:code];
            } else {
              dispatch_async(dispatch_get_main_queue(), ^{
                [self showGitHubError:@"No authorization code received"];
              });
            }
          }
        }];

    if (@available(iOS 13.0, *)) {
      authSession.prefersEphemeralWebBrowserSession = NO;
      authSession.presentationContextProvider = (id<ASWebAuthenticationPresentationContextProviding>)self;
    }

    // Store session to prevent deallocation
    self.githubAuthSession = authSession;
    [authSession start];
  } else {
    [self showGitHubError:@"GitHub authentication requires iOS 12 or later"];
  }
}

- (void)exchangeGitHubCodeForToken:(NSString *)code {
  NSLog(@"🔄 [GitHub] Exchanging code for token");

  NSString *clerkId = self.chatSession[@"createdBy"];

  if (!clerkId) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self showGitHubError:@"No user session found. Please try again."];
    });
    return;
  }

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService exchangeGitHubCode:code
                          forClerkId:clerkId
                          completion:^(BOOL success, NSString * _Nullable username, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error || !success) {
        [self showGitHubError:error.localizedDescription ?: @"Failed to connect GitHub"];
        return;
      }

      self.isGitHubConnected = YES;
      self.githubUsername = username;
      [self updateGitHubButtonStatusIndicator];

      UIAlertController *alert = [UIAlertController
          alertControllerWithTitle:@"GitHub Connected"
                           message:[NSString stringWithFormat:@"Connected as @%@\n\nWould you like to create a repository now?", username]
                    preferredStyle:UIAlertControllerStyleAlert];

      [alert addAction:[UIAlertAction actionWithTitle:@"Create Repository"
                                                style:UIAlertActionStyleDefault
                                              handler:^(UIAlertAction *action) {
        [self showCreateRepoDialog];
      }]];

      [alert addAction:[UIAlertAction actionWithTitle:@"Later"
                                                style:UIAlertActionStyleCancel
                                              handler:nil]];

      UIWindow *window = [UIApplication sharedApplication].keyWindow;
      UIViewController *rootVC = window.rootViewController;
      while (rootVC.presentedViewController) {
        rootVC = rootVC.presentedViewController;
      }
      [rootVC presentViewController:alert animated:YES completion:nil];
    });
  }];
}

- (void)startGitHubStatusPolling {
  [self stopGitHubStatusPolling];
  self.githubStatusPollingTimer = [NSTimer scheduledTimerWithTimeInterval:2.0
                                                                   target:self
                                                                 selector:@selector(pollGitHubStatus)
                                                                 userInfo:nil
                                                                  repeats:YES];
}

- (void)stopGitHubStatusPolling {
  if (self.githubStatusPollingTimer) {
    [self.githubStatusPollingTimer invalidate];
    self.githubStatusPollingTimer = nil;
  }
}

- (void)pollGitHubStatus {
  NSString *convexId = self.chatSessionId;
  if (!convexId) {
    [self stopGitHubStatusPolling];
    return;
  }

  EXChatBackendService *backendService = [EXChatBackendService sharedInstance];
  [backendService getGitHubStatusForSession:convexId
                                 completion:^(NSDictionary * _Nullable status, NSError * _Nullable error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) return;

      NSString *pushStatus = status[@"githubPushStatus"];
      self.githubPushStatus = pushStatus;
      [self updateGitHubButtonStatusIndicator];

      if ([pushStatus isEqualToString:@"completed"]) {
        [self stopGitHubStatusPolling];

        UIAlertController *alert = [UIAlertController
            alertControllerWithTitle:@"Push Complete"
                             message:@"Your code has been pushed to GitHub."
                      preferredStyle:UIAlertControllerStyleAlert];

        [alert addAction:[UIAlertAction actionWithTitle:@"View on GitHub"
                                                  style:UIAlertActionStyleDefault
                                                handler:^(UIAlertAction *action) {
          if (self.githubRepositoryUrl) {
            NSURL *url = [NSURL URLWithString:self.githubRepositoryUrl];
            if (url) {
              [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
            }
          }
        }]];

        [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                                  style:UIAlertActionStyleCancel
                                                handler:nil]];

        UIWindow *window = [UIApplication sharedApplication].keyWindow;
        UIViewController *rootVC = window.rootViewController;
        while (rootVC.presentedViewController) {
          rootVC = rootVC.presentedViewController;
        }
        [rootVC presentViewController:alert animated:YES completion:nil];

      } else if ([pushStatus isEqualToString:@"failed"]) {
        [self stopGitHubStatusPolling];
        [self showGitHubError:@"Push to GitHub failed. Please try again."];
      }
    });
  }];
}

- (void)updateGitHubButtonStatusIndicator {
  if (!self.githubButton) return;

  UIView *existingIndicator = [self.githubGroupBackground.contentView viewWithTag:999];
  [existingIndicator removeFromSuperview];

  if (self.isGitHubActionInProgress || [self.githubPushStatus isEqualToString:@"in_progress"]) {
    UIView *statusDot = [[UIView alloc] init];
    statusDot.tag = 999;
    statusDot.backgroundColor = [UIColor colorWithRed:245.0/255.0 green:158.0/255.0 blue:11.0/255.0 alpha:1.0];
    statusDot.layer.cornerRadius = 5;
    statusDot.translatesAutoresizingMaskIntoConstraints = NO;
    [self.githubGroupBackground.contentView addSubview:statusDot];

    [NSLayoutConstraint activateConstraints:@[
      [statusDot.widthAnchor constraintEqualToConstant:10],
      [statusDot.heightAnchor constraintEqualToConstant:10],
      [statusDot.bottomAnchor constraintEqualToAnchor:self.githubGroupBackground.bottomAnchor constant:-4],
      [statusDot.trailingAnchor constraintEqualToAnchor:self.githubGroupBackground.trailingAnchor constant:-4],
    ]];

    CABasicAnimation *pulseAnimation = [CABasicAnimation animationWithKeyPath:@"opacity"];
    pulseAnimation.fromValue = @1.0;
    pulseAnimation.toValue = @0.3;
    pulseAnimation.duration = 0.5;
    pulseAnimation.autoreverses = YES;
    pulseAnimation.repeatCount = HUGE_VALF;
    [statusDot.layer addAnimation:pulseAnimation forKey:@"pulse"];

  } else if ([self.githubPushStatus isEqualToString:@"completed"]) {
    UIView *statusDot = [[UIView alloc] init];
    statusDot.tag = 999;
    statusDot.backgroundColor = [UIColor colorWithRed:34.0/255.0 green:197.0/255.0 blue:94.0/255.0 alpha:1.0];
    statusDot.layer.cornerRadius = 5;
    statusDot.translatesAutoresizingMaskIntoConstraints = NO;
    [self.githubGroupBackground.contentView addSubview:statusDot];

    [NSLayoutConstraint activateConstraints:@[
      [statusDot.widthAnchor constraintEqualToConstant:10],
      [statusDot.heightAnchor constraintEqualToConstant:10],
      [statusDot.bottomAnchor constraintEqualToAnchor:self.githubGroupBackground.bottomAnchor constant:-4],
      [statusDot.trailingAnchor constraintEqualToAnchor:self.githubGroupBackground.trailingAnchor constant:-4],
    ]];

  } else if ([self.githubPushStatus isEqualToString:@"failed"]) {
    UIView *statusDot = [[UIView alloc] init];
    statusDot.tag = 999;
    statusDot.backgroundColor = [UIColor colorWithRed:239.0/255.0 green:68.0/255.0 blue:68.0/255.0 alpha:1.0];
    statusDot.layer.cornerRadius = 5;
    statusDot.translatesAutoresizingMaskIntoConstraints = NO;
    [self.githubGroupBackground.contentView addSubview:statusDot];

    [NSLayoutConstraint activateConstraints:@[
      [statusDot.widthAnchor constraintEqualToConstant:10],
      [statusDot.heightAnchor constraintEqualToConstant:10],
      [statusDot.bottomAnchor constraintEqualToAnchor:self.githubGroupBackground.bottomAnchor constant:-4],
      [statusDot.trailingAnchor constraintEqualToAnchor:self.githubGroupBackground.trailingAnchor constant:-4],
    ]];
  }
}

- (void)showGitHubError:(NSString *)message {
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"GitHub Error"
                       message:message
                preferredStyle:UIAlertControllerStyleAlert];
  [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

#pragma mark - ASWebAuthenticationPresentationContextProviding

- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:(ASWebAuthenticationSession *)session API_AVAILABLE(ios(13.0)) {
  return [UIApplication sharedApplication].keyWindow;
}

@end
