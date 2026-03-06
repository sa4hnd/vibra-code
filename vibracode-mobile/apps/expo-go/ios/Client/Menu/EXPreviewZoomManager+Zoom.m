// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAppViewController.h"
#import "EXKernel.h"
#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXAppLoadingProgressWindowController.h"

@implementation EXPreviewZoomManager (Zoom)

#pragma mark - Zoom Management

- (void)zoomOut {
  NSLog(@"🔵 [ZoomManager] zoomOut called - isZoomed: %@, isAnimating: %@",
        self.isZoomed ? @"YES" : @"NO",
        self.isAnimating ? @"YES" : @"NO");

  if (self.isZoomed) {
    NSLog(@"🔵 [ZoomManager] Already zoomed out, returning");
    return; // Already zoomed out
  }

  // Prevent duplicate animations from rapid toggling
  if (self.isAnimating) {
    NSLog(@"🔵 [ZoomManager] Animation in progress, ignoring zoomOut");
    return;
  }

  self.isAnimating = YES;

  EXKernel *kernel = [EXKernel sharedInstance];
  EXAppViewController *visibleAppViewController =
      kernel.visibleApp.viewController;

  // Hide loading progress window to prevent overlap with bottom bar
  if ([visibleAppViewController respondsToSelector:@selector(appLoadingProgressWindowController)]) {
    EXAppLoadingProgressWindowController *loadingController =
        [visibleAppViewController valueForKey:@"appLoadingProgressWindowController"];
    [loadingController hide];
  }

  if (!visibleAppViewController || !visibleAppViewController.contentView) {
    NSLog(@"🔵 [ZoomManager] Early return - no visibleAppViewController (%@) or contentView (%@)",
          visibleAppViewController ? @"exists" : @"nil",
          visibleAppViewController.contentView ? @"exists" : @"nil");
    self.isAnimating = NO; // Clear on early return
    return; // No visible app to zoom
  }

  // Don't zoom the home app
  if (kernel.visibleApp == kernel.appRegistry.homeAppRecord) {
    NSLog(@"🔵 [ZoomManager] Early return - this is the home app");
    self.isAnimating = NO; // Clear on early return
    return;
  }

  UIView *contentView = visibleAppViewController.contentView;
  UIView *superview = visibleAppViewController.view; // Always use the VC's view - it's always there
  UIWindow *window = [UIApplication sharedApplication].keyWindow ?: [UIApplication sharedApplication].windows.firstObject;

  if (!window || !superview) {
    NSLog(@"🔵 [ZoomManager] No window or superview, retrying in 0.3s");
    self.isAnimating = NO;
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [weakSelf zoomOut];
    });
    return;
  }

  // Make sure contentView is in the view hierarchy
  if (!contentView.superview) {
    [superview addSubview:contentView];
    [superview sendSubviewToBack:contentView];
  }

  // Set frame if empty
  if (CGRectIsEmpty(contentView.frame)) {
    contentView.frame = superview.bounds;
  }

  NSLog(@"🔵 [ZoomManager] Proceeding with zoom - contentView frame: %@",
        NSStringFromCGRect(contentView.frame));

  // Force layout to ensure safe area insets are calculated correctly (fixes
  // first-time zoom issue)
  [window layoutIfNeeded];
  if (window.rootViewController && window.rootViewController.view) {
    [window.rootViewController.view layoutIfNeeded];
  }
  [superview layoutIfNeeded];

  self.isZoomed = YES;

  // Store references for contentView replacement handling
  self.observedContentView = contentView;
  self.storedSuperview = superview;

  // Save original superview background color and set it to darker gray (this
  // fills empty space around scaled preview)
  self.originalSuperviewBackgroundColor = superview.backgroundColor;
  superview.backgroundColor = [UIColor colorWithRed:0.1
                                              green:0.1
                                               blue:0.1
                                              alpha:1.0]; // Darker gray

  // Create container view with dark gray background and rounded corners
  // IMPORTANT: Always recreate if it doesn't exist OR if contentView is not inside it
  BOOL needsNewContainer = !self.previewContainerView ||
                           !self.previewContainerView.superview ||
                           ![contentView isDescendantOfView:self.previewContainerView];

  if (needsNewContainer) {
    // Remove old container if it exists
    if (self.previewContainerView) {
      [self.previewContainerView removeFromSuperview];
      self.previewContainerView = nil;
    }

    CGRect contentFrame = contentView.frame;
    self.previewContainerView = [[UIView alloc] initWithFrame:contentFrame];
    self.previewContainerView.backgroundColor = [UIColor colorWithRed:0.12
                                                                green:0.12
                                                                 blue:0.12
                                                                alpha:1.0];
    CGFloat cornerRadius = [self responsiveCornerRadius:20.0];
    self.previewContainerView.layer.cornerRadius = cornerRadius;
    self.previewContainerView.layer.masksToBounds = YES;
    self.previewContainerView.clipsToBounds = YES;

    // Insert container behind contentView
    [superview insertSubview:self.previewContainerView
                belowSubview:contentView];

    // Wrap contentView: move it into container and adjust frame
    CGRect bounds = contentView.bounds;
    [contentView removeFromSuperview];
    contentView.frame = bounds;
    [self.previewContainerView addSubview:contentView];

    NSLog(@"🔵 [ZoomManager] Created new previewContainerView and added contentView");

    // If error view exists and was in self.view (simple approach), move it to container
    // This handles error views that were shown before zoom completed
    if (self.errorView && self.errorView != contentView && self.errorView.superview == superview) {
      NSLog(@"🔵 [ZoomManager] Moving error view to previewContainerView");
      [self.errorView removeFromSuperview];
      self.errorView.frame = self.previewContainerView.bounds;
      [self.previewContainerView addSubview:self.errorView];
      self.errorView.layer.zPosition = 100;
    }
  } else {
    NSLog(@"🔵 [ZoomManager] Reusing existing previewContainerView with contentView already inside");
  }

  // Ensure contentView has rounded corners and dark background visible
  CGFloat contentCornerRadius = [self responsiveCornerRadius:20.0];
  contentView.layer.cornerRadius = contentCornerRadius;
  contentView.layer.masksToBounds = YES;
  contentView.clipsToBounds = YES;

  // Add tap gesture recognizer to container view to detect taps for zoom in
  if (!self.tapGestureRecognizer) {
    self.tapGestureRecognizer =
        [[UITapGestureRecognizer alloc] initWithTarget:self
                                                action:@selector(handleTap:)];
    self.tapGestureRecognizer.numberOfTapsRequired = 1;
  }
  [self.previewContainerView addGestureRecognizer:self.tapGestureRecognizer];

  // Add tap gesture recognizer to superview to detect taps on empty space
  // (dismiss keyboard)
  if (!self.superviewTapGesture) {
    self.superviewTapGesture = [[UITapGestureRecognizer alloc]
        initWithTarget:self
                action:@selector(handleSuperviewTap:)];
    self.superviewTapGesture.numberOfTapsRequired = 1;
    self.superviewTapGesture.cancelsTouchesInView =
        NO; // Don't interfere with other gestures
  }
  [superview addGestureRecognizer:self.superviewTapGesture];

  // Create and add top bar
  if (!self.topBarView) {
    self.topBarView = [self createTopBarView:superview];
    if (self.topBarView) {
      [superview bringSubviewToFront:self.topBarView];
      // Set zPosition to ensure consistent layering (below bottom bar)
      self.topBarView.layer.zPosition = 900.0;

      // Set initial state for animation
      self.topBarView.alpha = 0.0;
      CGRect topBarFrame = self.topBarView.frame;
      if (topBarFrame.size.height > 0) {
        self.topBarView.transform =
            CGAffineTransformMakeTranslation(0, -topBarFrame.size.height);
      } else {
        // Fallback: use estimated height if frame not yet calculated
        self.topBarView.transform = CGAffineTransformMakeTranslation(0, -100);
      }

      // Top bar positioning will be fixed in the animation completion block
      // This ensures it happens after the view hierarchy is fully laid out and
      // animated
    }
  }

  // Create and add bottom bar
  if (!self.bottomBarView) {
    self.bottomBarView = [self createBottomBarView:superview];
    if (self.bottomBarView) {
      [superview bringSubviewToFront:self.bottomBarView];
      // Set high zPosition to ensure bottom bar is always rendered on top
      self.bottomBarView.layer.zPosition = 1000.0;

      // Add tap gesture recognizer to prevent zoom in when tapping bottom bar
      UITapGestureRecognizer *bottomBarTapGesture =
          [[UITapGestureRecognizer alloc]
              initWithTarget:self
                      action:@selector(handleBottomBarTap:)];
      bottomBarTapGesture.numberOfTapsRequired = 1;
      bottomBarTapGesture.cancelsTouchesInView =
          NO; // Allow buttons to receive touches
      bottomBarTapGesture.delaysTouchesBegan = NO; // Don't delay touches
      bottomBarTapGesture.delaysTouchesEnded = NO; // Don't delay touches
      [self.bottomBarView addGestureRecognizer:bottomBarTapGesture];

      // Force layout to get proper size
      [superview layoutIfNeeded];

      // Set initial state for animation
      self.bottomBarView.alpha = 0.0;
      CGRect barFrame = self.bottomBarView.frame;
      if (barFrame.size.height > 0) {
        self.bottomBarView.transform =
            CGAffineTransformMakeTranslation(0, barFrame.size.height);
      } else {
        // Fallback: use estimated height if frame not yet calculated
        self.bottomBarView.transform = CGAffineTransformMakeTranslation(0, 200);
      }

      // Pre-load session so send button works even when chat is closed
      if ([self respondsToSelector:@selector(lookupSessionAndLoadMessagesWithErrorHandler:)]) {
        [self performSelector:@selector(lookupSessionAndLoadMessagesWithErrorHandler:) withObject:nil];
      }

      // Restore persisted input text if any
      if (self.persistedInputText && self.persistedInputText.length > 0 && self.inputTextView) {
        self.inputTextView.text = self.persistedInputText;
        self.inputTextView.textColor = [UIColor whiteColor];
        // Trigger text change notification to update send button visibility
        [[NSNotificationCenter defaultCenter]
            postNotificationName:UITextViewTextDidChangeNotification
                          object:self.inputTextView];
      }
    }
  }

  // Apply 3D transform with scale and perspective rotation to container
  // iPad: 68% scale for better screen utilization, adjusted perspective
  // iPhone: 55% scale (more zoomed out)
  CATransform3D transform = CATransform3DIdentity;
  // iPad uses gentler perspective for better visual effect on larger screen
  CGFloat perspective = [self isIPad] ? -1.0 / 1200.0 : -1.0 / 1000.0;
  transform.m34 = perspective;
  CGFloat scale = [self isIPad] ? 0.68 : 0.55;
  transform = CATransform3DScale(transform, scale, scale, 1.0);
  // Slightly less rotation on iPad for a more subtle 3D effect
  CGFloat rotationAngle = [self isIPad] ? 0.08 : 0.1;
  transform = CATransform3DRotate(transform, rotationAngle, 1.0, 0.0,
                                  0.0); // Slight rotation on X axis
  // Move preview UP to position it higher on screen
  // Negative Y moves up, positive moves down
  // iPad: -120 (moved higher from -80), iPhone: -60 (added upward translation)
  CGFloat translateY = [self isIPad] ? -120.0 : -60.0;
  transform = CATransform3DTranslate(transform, 0, translateY, 0);

  // Find and store splash screen view if visible
  // The splash screen is identified by:
  // 1. Having a CAGradientLayer as its first sublayer (old method), OR
  // 2. Being positioned above contentView and containing a UIImageView (new managed splash screen)
  self.splashScreenView = nil;
  for (UIView *sibling in superview.subviews) {
    // Skip views we manage
    if (sibling == self.previewContainerView || sibling == self.topBarView ||
        sibling == self.bottomBarView) {
      continue;
    }
    // Method 1: Splash screen has a CAGradientLayer as its first sublayer (legacy)
    if (sibling.layer.sublayers.count > 0 &&
        [sibling.layer.sublayers.firstObject isKindOfClass:[CAGradientLayer class]]) {
      self.splashScreenView = sibling;
      break;
    }
    // Method 2: New managed splash screen - has UIImageView for background
    // Check if this view has an imageView subview (backgroundImageView) and is above contentView
    BOOL hasImageView = NO;
    for (UIView *subview in sibling.subviews) {
      if ([subview isKindOfClass:[UIImageView class]]) {
        hasImageView = YES;
        break;
      }
    }
    // If it has an imageView and is NOT the contentView itself, it's likely the splash screen
    if (hasImageView && sibling != contentView && sibling.frame.size.width > 0) {
      self.splashScreenView = sibling;
      break;
    }
  }

  // Check if the content view is an error view (EXErrorView)
  // If so, we should NOT show splash screen above it
  BOOL isShowingErrorView = [NSStringFromClass([contentView class]) isEqualToString:@"EXErrorView"];

  // Also check if we have an errorView reference (from handleErrorViewShown)
  if (self.errorView && self.errorView.superview) {
    isShowingErrorView = YES;
  }

  // Position splash screen relative to preview container
  // But below the top/bottom bars (they have high zPosition values)
  if (self.splashScreenView && self.previewContainerView) {
    if (isShowingErrorView) {
      // Error view is showing - hide splash screen so error is visible
      self.splashScreenView.hidden = YES;
      NSLog(@"🔵 [ZoomManager] Hiding splash screen - error view is showing");
    } else {
      // Normal app loading - show splash screen ABOVE preview container
      self.splashScreenView.hidden = NO;
      [superview insertSubview:self.splashScreenView aboveSubview:self.previewContainerView];

      // IMPORTANT: Set splash screen frame to match container EXACTLY
      // This prevents any gap or gray rectangle showing through
      self.splashScreenView.frame = self.previewContainerView.frame;

      // Apply rounded corners to splash screen to match preview container
      CGFloat splashCornerRadius = [self responsiveCornerRadius:20.0];
      self.splashScreenView.layer.cornerRadius = splashCornerRadius;
      self.splashScreenView.layer.masksToBounds = YES;
      self.splashScreenView.clipsToBounds = YES;

      NSLog(@"🔵 [ZoomManager] Positioned splash screen above previewContainerView, frame: %@",
            NSStringFromCGRect(self.splashScreenView.frame));
    }
  }

  // Use UIViewPropertyAnimator with Apple's recommended spring parameters
  // iOS 17+ bounce-based API provides the most natural spring feel
  // FASTER animations - reduced from 0.5 to 0.35
  UISpringTimingParameters *springParams;
  if (@available(iOS 17.0, *)) {
    springParams = [[UISpringTimingParameters alloc]
        initWithDuration:0.35
        bounce:0.08];  // Less bounce for snappier feel
  } else {
    // Fallback for iOS 16 and earlier
    springParams = [[UISpringTimingParameters alloc]
        initWithDampingRatio:0.88
        initialVelocity:CGVectorMake(0, 0.6)];
  }

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:0.35
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;

  [animator addAnimations:^{
    weakSelf.previewContainerView.layer.transform = transform;
    // Also transform splash screen if visible (not hidden)
    if (weakSelf.splashScreenView && !weakSelf.splashScreenView.hidden) {
      weakSelf.splashScreenView.layer.transform = transform;
    }
  }];

  // Bottom bar spring animation with staggered start
  // FASTER - reduced from 0.45 to 0.3
  if (self.bottomBarView) {
    UISpringTimingParameters *barSpring;
    if (@available(iOS 17.0, *)) {
      barSpring = [[UISpringTimingParameters alloc]
          initWithDuration:0.3
          bounce:0.06];
    } else {
      barSpring = [[UISpringTimingParameters alloc]
          initWithDampingRatio:0.9
          initialVelocity:CGVectorMake(0, 0.9)];
    }

    UIViewPropertyAnimator *bottomAnimator = [[UIViewPropertyAnimator alloc]
        initWithDuration:0.3
        timingParameters:barSpring];

    [bottomAnimator addAnimations:^{
      weakSelf.bottomBarView.alpha = 1.0;
      weakSelf.bottomBarView.transform = CGAffineTransformIdentity;
    }];

    [bottomAnimator startAnimation];
  }

  // Top bar spring animation
  // FASTER - reduced from 0.45 to 0.3
  if (self.topBarView) {
    UISpringTimingParameters *topBarSpring;
    if (@available(iOS 17.0, *)) {
      topBarSpring = [[UISpringTimingParameters alloc]
          initWithDuration:0.3
          bounce:0.06];
    } else {
      topBarSpring = [[UISpringTimingParameters alloc]
          initWithDampingRatio:0.9
          initialVelocity:CGVectorMake(0, 0.9)];
    }

    UIViewPropertyAnimator *topAnimator = [[UIViewPropertyAnimator alloc]
        initWithDuration:0.3
        timingParameters:topBarSpring];

    [topAnimator addAnimations:^{
      weakSelf.topBarView.alpha = 1.0;
      weakSelf.topBarView.transform = CGAffineTransformIdentity;
    }];

    [topAnimator startAnimation];
  }

  [animator addCompletion:^(UIViewAnimatingPosition finalPosition) {
    // Clear animation lock
    weakSelf.isAnimating = NO;

    // Restore stop button state if agent was running before zoom
    if (weakSelf.isAgentRunning) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf updateSendButtonForAgentState];
      });
    }
  }];

  [animator startAnimation];
}

- (void)zoomOutWithCompletion:(void (^)(void))completion {
  // Call the regular zoomOut first
  [self zoomOut];

  // Call completion after animation delay (faster now)
  if (completion) {
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.25 * NSEC_PER_SEC)),
        dispatch_get_main_queue(), ^{
          completion();
        });
  }
}

- (void)zoomIn {
  NSLog(@"🔵 [ZoomManager] zoomIn called - isZoomed: %@, isAnimating: %@",
        self.isZoomed ? @"YES" : @"NO",
        self.isAnimating ? @"YES" : @"NO");

  if (!self.isZoomed) {
    NSLog(@"🔵 [ZoomManager] Already zoomed in, returning");
    return; // Already zoomed in
  }

  // Prevent duplicate animations from rapid toggling
  if (self.isAnimating) {
    NSLog(@"🔵 [ZoomManager] Animation in progress, ignoring zoomIn");
    return;
  }

  self.isAnimating = YES;

  // Hide chat if active before zooming in
  if (self.isChatMode) {
    [self hideChat];
    // Wait for chat to hide before proceeding with zoom in (faster delay)
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.25 * NSEC_PER_SEC)),
        dispatch_get_main_queue(), ^{
          [self performZoomIn];
        });
    return;
  }

  [self performZoomIn];
}

- (void)performZoomIn {
  EXKernel *kernel = [EXKernel sharedInstance];
  EXAppViewController *visibleAppViewController =
      kernel.visibleApp.viewController;

  if (!visibleAppViewController || !visibleAppViewController.contentView) {
    self.isAnimating = NO; // Clear on early return
    return;
  }

  UIView *contentView = visibleAppViewController.contentView;
  UIView *originalSuperview = self.previewContainerView
                                  ? self.previewContainerView.superview
                                  : contentView.superview;

  // Check if the content view is an error view - if so, DON'T show splash screen
  BOOL isShowingErrorView = [NSStringFromClass([contentView class]) isEqualToString:@"EXErrorView"];

  // Save the current input text before destroying the bottom bar
  if (self.inputTextView) {
    NSString *currentText = self.inputTextView.text;
    // Don't save placeholder text
    if (currentText && currentText.length > 0 && ![currentText isEqualToString:@"Message"]) {
      self.persistedInputText = currentText;
    } else {
      self.persistedInputText = nil;
    }
  }

  self.isZoomed = NO;
  self.isChatMode = NO;

  // NOTE: No need to manage superview background color - when the preview is fullscreen,
  // it covers everything. The superview background is only visible when zoomed out.

  // Clear stored references
  self.observedContentView = nil;
  self.storedSuperview = nil;

  // Remove tap gesture recognizers
  if (self.tapGestureRecognizer && self.previewContainerView) {
    [self.previewContainerView
        removeGestureRecognizer:self.tapGestureRecognizer];
  }
  if (self.superviewTapGesture && originalSuperview) {
    [originalSuperview removeGestureRecognizer:self.superviewTapGesture];
    self.superviewTapGesture = nil;
  }

  // Animate bars out using UIViewPropertyAnimator for smooth spring animations
  UIView *bottomBarToRemove = self.bottomBarView;
  UIView *topBarToRemove = self.topBarView;
  CGRect bottomBarFrame =
      bottomBarToRemove ? bottomBarToRemove.frame : CGRectZero;
  CGRect topBarFrame = topBarToRemove ? topBarToRemove.frame : CGRectZero;

  // Use UIViewPropertyAnimator with Apple's recommended spring parameters
  // FASTER - reduced from 0.45 to 0.3
  UISpringTimingParameters *springParams;
  if (@available(iOS 17.0, *)) {
    springParams = [[UISpringTimingParameters alloc]
        initWithDuration:0.3
        bounce:0.0];  // No bounce for snappy zoom-in
  } else {
    springParams = [[UISpringTimingParameters alloc]
        initWithDampingRatio:1.0
        initialVelocity:CGVectorMake(0, 0.6)];
  }

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:0.3
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;

  [animator addAnimations:^{
    // Animate preview back to fullscreen - it will cover the superview completely
    if (weakSelf.previewContainerView) {
      weakSelf.previewContainerView.layer.transform = CATransform3DIdentity;
      weakSelf.previewContainerView.layer.cornerRadius = 0.0;
      weakSelf.previewContainerView.alpha = 1.0; // Restore alpha (was dimmed when chat was shown)
      // Clear container background - we don't need it when fullscreen
      // This prevents the container's dark background from showing during animation
      weakSelf.previewContainerView.backgroundColor = [UIColor clearColor];
    }
    // Reset splash screen transform, corner radius, alpha
    // BUT only show it if we're NOT showing an error view
    if (weakSelf.splashScreenView) {
      weakSelf.splashScreenView.layer.transform = CATransform3DIdentity;
      weakSelf.splashScreenView.layer.cornerRadius = 0.0;
      weakSelf.splashScreenView.alpha = 1.0; // Restore alpha
      // IMPORTANT: Only show splash screen if NOT showing error view
      // Error view should be fully visible, not covered by splash screen
      if (!isShowingErrorView) {
        weakSelf.splashScreenView.hidden = NO;
      }
    }
    contentView.layer.cornerRadius = 0.0;
  }];

  // Bottom bar slide out animation - use SAME timing as main animator for synchronization
  if (bottomBarToRemove) {
    UIViewPropertyAnimator *bottomAnimator = [[UIViewPropertyAnimator alloc]
        initWithDuration:0.3
        timingParameters:springParams];

    [bottomAnimator addAnimations:^{
      bottomBarToRemove.alpha = 0.0;
      bottomBarToRemove.transform =
          CGAffineTransformMakeTranslation(0, bottomBarFrame.size.height);
    }];

    [bottomAnimator startAnimation];
  }

  // Top bar slide out animation - use SAME timing as main animator for synchronization
  if (topBarToRemove) {
    UIViewPropertyAnimator *topAnimator = [[UIViewPropertyAnimator alloc]
        initWithDuration:0.3
        timingParameters:springParams];

    [topAnimator addAnimations:^{
      topBarToRemove.alpha = 0.0;
      topBarToRemove.transform =
          CGAffineTransformMakeTranslation(0, -topBarFrame.size.height);
    }];

    [topAnimator startAnimation];
  }

  // Hide chevron up button to prevent glitch
  if (self.bottomBarChevronButton) {
    self.bottomBarChevronButton.alpha = 0.0;
    self.bottomBarChevronButton.hidden = YES;
  }

  [animator addCompletion:^(UIViewAnimatingPosition finalPosition) {
    // Move contentView back to original superview and remove container
    if (weakSelf.previewContainerView && originalSuperview) {
      CGRect containerFrame = weakSelf.previewContainerView.frame;
      [contentView removeFromSuperview];
      contentView.frame = containerFrame;
      [originalSuperview addSubview:contentView];
      [weakSelf.previewContainerView removeFromSuperview];
      weakSelf.previewContainerView = nil;
    }
    // Remove bars
    if (bottomBarToRemove) {
      [bottomBarToRemove removeFromSuperview];
      weakSelf.bottomBarView = nil;

      // Clear all child view references to prevent use-after-free crash
      weakSelf.bottomBarChevronButton = nil;
      weakSelf.inputTextView = nil;
      weakSelf.sendButton = nil;
      weakSelf.micButton = nil;
      weakSelf.modelSelectorButton = nil;
      weakSelf.imageButton = nil;
      weakSelf.micToSendConstraint = nil;
      weakSelf.micToContainerConstraint = nil;
      weakSelf.imageButtonLeadingToModelConstraint = nil;
      weakSelf.imageButtonLeadingToContainerConstraint = nil;
    }
    if (topBarToRemove) {
      [topBarToRemove removeFromSuperview];
      weakSelf.topBarView = nil;

      // Clear all top bar child view references to prevent use-after-free crash
      weakSelf.appNameLabel = nil;
      weakSelf.threeDotsButton = nil;
      weakSelf.refreshButton = nil;
      weakSelf.chevronDownButton = nil;
      weakSelf.clearHistoryButton = nil;
      weakSelf.leftGroupBackground = nil;
      weakSelf.rightGroupBackground = nil;
      weakSelf.chevronGroupBackground = nil;
      weakSelf.clearHistoryBackground = nil;
      weakSelf.appNameCenterConstraint = nil;
      weakSelf.appNameLeftConstraint = nil;
    }

    // Clear splash screen reference
    weakSelf.splashScreenView = nil;

    // Show loading progress window again if app is still loading
    // BUT only if splash screen doesn't have integrated progress
    if ([visibleAppViewController respondsToSelector:@selector(isLoading)] &&
        [[visibleAppViewController valueForKey:@"isLoading"] boolValue]) {
      // Check if managed splash screen has integrated progress - if so, don't show separate window
      BOOL splashHasProgress = NO;
      if ([visibleAppViewController respondsToSelector:@selector(managedAppSplashScreenViewProvider)]) {
        id splashProvider = [visibleAppViewController valueForKey:@"managedAppSplashScreenViewProvider"];
        if (splashProvider && [splashProvider respondsToSelector:@selector(isShowingProgress)]) {
          splashHasProgress = [[splashProvider valueForKey:@"isShowingProgress"] boolValue];
        }
      }

      if (!splashHasProgress) {
        if ([visibleAppViewController respondsToSelector:@selector(appLoadingProgressWindowController)]) {
          EXAppLoadingProgressWindowController *loadingController =
              [visibleAppViewController valueForKey:@"appLoadingProgressWindowController"];
          [loadingController show];
        }
      }
    }

    // Clear animation lock
    weakSelf.isAnimating = NO;
  }];

  [animator startAnimation];
}

- (void)handleContentViewReplacement:(UIView *)newContentView {
  // This is called when the app reloads and contentView is replaced
  // Don't zoom out immediately - wait for JavaScript to finish loading

  // Always set the flag to zoom out after reload, regardless of current zoom state
  // This ensures that after any reload triggered while zoomed, we'll zoom out again
  BOOL wasZoomed = self.isZoomed;

  NSLog(@"🔵 [ZoomManager] handleContentViewReplacement - wasZoomed: %@", wasZoomed ? @"YES" : @"NO");

  // Restore the original superview background color if we changed it
  if (self.storedSuperview && self.originalSuperviewBackgroundColor) {
    self.storedSuperview.backgroundColor = self.originalSuperviewBackgroundColor;
  }

  // Clean up all existing views if we were zoomed
  if (wasZoomed) {
    if (self.previewContainerView) {
      [self.previewContainerView removeFromSuperview];
      self.previewContainerView = nil;
    }
    if (self.topBarView) {
      [self.topBarView removeFromSuperview];
      self.topBarView = nil;

      // Clear all top bar child view references
      self.appNameLabel = nil;
      self.threeDotsButton = nil;
      self.refreshButton = nil;
      self.chevronDownButton = nil;
      self.clearHistoryButton = nil;
      self.leftGroupBackground = nil;
      self.rightGroupBackground = nil;
      self.chevronGroupBackground = nil;
      self.clearHistoryBackground = nil;
      self.appNameCenterConstraint = nil;
      self.appNameLeftConstraint = nil;
    }
    if (self.bottomBarView) {
      [self.bottomBarView removeFromSuperview];
      self.bottomBarView = nil;

      // Clear all child view references to prevent use-after-free crash
      self.bottomBarChevronButton = nil;
      self.inputTextView = nil;
      self.sendButton = nil;
      self.micButton = nil;
      self.modelSelectorButton = nil;
      self.imageButton = nil;
      self.micToSendConstraint = nil;
      self.micToContainerConstraint = nil;
      self.imageButtonLeadingToModelConstraint = nil;
      self.imageButtonLeadingToContainerConstraint = nil;
    }
    if (self.chatView) {
      [self.chatView removeFromSuperview];
      self.chatView = nil;
    }
    self.tapGestureRecognizer = nil;
    if (self.superviewTapGesture && self.storedSuperview) {
      [self.storedSuperview removeGestureRecognizer:self.superviewTapGesture];
      self.superviewTapGesture = nil;
    }
  }

  // Clear stored references
  self.observedContentView = nil;
  self.storedSuperview = nil;
  self.originalSuperviewBackgroundColor = nil;

  // Reset splash screen transform and clear reference
  if (self.splashScreenView) {
    self.splashScreenView.layer.transform = CATransform3DIdentity;
    self.splashScreenView = nil;
  }

  // Reset zoom state
  self.isZoomed = NO;
  self.isChatMode = NO;
  self.isAnimating = NO;

  // Set flag to zoom out after JavaScript finishes loading
  // This ensures subsequent reloads will still trigger zoom out
  self.needsZoomAfterReload = YES;
  NSLog(@"🔵 [ZoomManager] handleContentViewReplacement complete - set needsZoomAfterReload = YES");
}

- (void)reapplyBackgroundColor {
  // Re-apply the dark gray background color to the superview
  if (self.isZoomed && self.storedSuperview) {
    self.storedSuperview.backgroundColor = [UIColor colorWithRed:0.1
                                                           green:0.1
                                                            blue:0.1
                                                           alpha:1.0];
  }
}

#pragma mark - Error View Handling

- (void)handleErrorViewShown:(UIView *)errorView {
  NSLog(@"🔵 [ZoomManager] handleErrorViewShown - isZoomed: %@, previewContainerView: %@",
        self.isZoomed ? @"YES" : @"NO",
        self.previewContainerView ? @"exists" : @"nil");

  // Store reference to error view
  self.errorView = errorView;

  // ALWAYS hide splash screen when error is showing
  // This is critical - splash screen can cover error view making it look like white screen
  if (self.splashScreenView) {
    NSLog(@"🔵 [ZoomManager] Hiding splash screen for error view");
    self.splashScreenView.hidden = YES;
  }

  // If zoomed out with valid container, move error view there
  if (self.isZoomed && self.previewContainerView &&
      self.previewContainerView.superview &&
      !CGRectIsEmpty(self.previewContainerView.bounds)) {

    NSLog(@"🔵 [ZoomManager] Moving error view to previewContainerView (bounds: %@)",
          NSStringFromCGRect(self.previewContainerView.bounds));

    // Move to previewContainer
    UIView *originalSuperview = errorView.superview;
    [errorView removeFromSuperview];
    errorView.frame = self.previewContainerView.bounds;
    [self.previewContainerView addSubview:errorView];

    // Set z-index above content but below bars
    errorView.layer.zPosition = 100;

    NSLog(@"🔵 [ZoomManager] Error view moved to container, frame: %@",
          NSStringFromCGRect(errorView.frame));
  } else {
    // If not zoomed or container is invalid, ensure error view is properly sized
    // It should already be in self.view, just make sure frame is valid
    if (CGRectIsEmpty(errorView.frame) || CGRectIsNull(errorView.frame)) {
      UIView *superview = errorView.superview;
      if (superview) {
        errorView.frame = superview.bounds;
      }
    }
    NSLog(@"🔵 [ZoomManager] Error view kept in original superview, frame: %@",
          NSStringFromCGRect(errorView.frame));
  }
}

@end
