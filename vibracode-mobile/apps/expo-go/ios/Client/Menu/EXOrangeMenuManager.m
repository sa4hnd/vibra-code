// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXOrangeMenuManager.h"
#import "EXHomeModule.h"
#import "EXDevMenuManager.h"
#import "EXPreviewZoomManager.h"
#import <UIKit/UIKit.h>

@interface EXOrangeMenuManager ()

@property (nonatomic, strong) UIWindow *orangeMenuWindow;
@property (nonatomic, strong) UIButton *orangeButton;
@property (nonatomic, strong) UIPanGestureRecognizer *panGestureRecognizer;
@property (nonatomic, assign) BOOL isButtonVisible;
@property (nonatomic, assign) CGPoint buttonPosition;
@property (nonatomic, assign) BOOL isDragging;

@end

@implementation EXOrangeMenuManager

+ (instancetype)sharedInstance
{
  static EXOrangeMenuManager *manager;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    manager = [EXOrangeMenuManager new];
    [manager loadButtonPosition];
  });
  return manager;
}

- (void)loadButtonPosition
{
  // Load saved position from UserDefaults, default to left edge vertically centered
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  CGFloat x = [defaults floatForKey:@"OrangeMenuButtonX"];
  CGFloat y = [defaults floatForKey:@"OrangeMenuButtonY"];
  
  if (x == 0 && y == 0) {
    // First time, use default position (left edge, vertically centered)
    CGFloat screenHeight = [UIScreen mainScreen].bounds.size.height;
    _buttonPosition = CGPointMake(10, screenHeight / 2 - 30); // Adjusted for circular 60x60 button
  } else {
    _buttonPosition = CGPointMake(x, y);
  }
}

- (void)saveButtonPosition
{
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  [defaults setFloat:_buttonPosition.x forKey:@"OrangeMenuButtonX"];
  [defaults setFloat:_buttonPosition.y forKey:@"OrangeMenuButtonY"];
  [defaults synchronize];
}

- (BOOL)isVisible
{
  // Check both flag and actual window/view hierarchy state
  BOOL windowActuallyVisible = _orangeMenuWindow && !_orangeMenuWindow.hidden;
  BOOL buttonActuallyVisible = _orangeButton && _orangeButton.superview != nil;
  
  // Sync flag with actual state if they're out of sync
  if (_isButtonVisible && (!windowActuallyVisible || !buttonActuallyVisible)) {
    _isButtonVisible = NO;
  }
  
  return _isButtonVisible && windowActuallyVisible && buttonActuallyVisible;
}

- (BOOL)showOrangeMenu
{
  // Check if window and button actually exist and are visible
  BOOL windowActuallyVisible = _orangeMenuWindow && !_orangeMenuWindow.hidden;
  BOOL buttonActuallyVisible = _orangeButton && _orangeButton.superview != nil;
  
  if (_isButtonVisible && windowActuallyVisible && buttonActuallyVisible) {
    return NO; // Already visible and actually in view hierarchy
  }
  
  // Reset flag if window/button was removed or hidden
  if (_isButtonVisible && (!windowActuallyVisible || !buttonActuallyVisible)) {
    _isButtonVisible = NO;
  }
  
  dispatch_async(dispatch_get_main_queue(), ^{
    [self createAndShowButton];
  });
  
  _isButtonVisible = YES;
  return YES;
}

- (BOOL)hideOrangeMenu
{
  if (!_isButtonVisible) {
    return NO;
  }
  
  dispatch_async(dispatch_get_main_queue(), ^{
    [self removeButton];
  });
  
  _isButtonVisible = NO;
  return YES;
}

- (BOOL)toggleOrangeMenu
{
  return self.isVisible ? [self hideOrangeMenu] : [self showOrangeMenu];
}

- (void)updateWindowLevel
{
  if (!_orangeMenuWindow) {
    return;
  }
  
  // Set window level dynamically based on dev menu visibility
  BOOL isDevMenuVisible = [[EXDevMenuManager sharedInstance] isVisible];
  if (isDevMenuVisible) {
    // When dev menu is open, orange menu should be below it
    _orangeMenuWindow.windowLevel = UIWindowLevelStatusBar - 1;
  } else {
    // When dev menu is closed, orange menu should be above loading screens
    _orangeMenuWindow.windowLevel = UIWindowLevelStatusBar + 2;
  }
}

- (void)handlePanGesture:(UIPanGestureRecognizer *)panGesture
{
  CGPoint translation = [panGesture translationInView:panGesture.view.superview];
  CGPoint velocity = [panGesture velocityInView:panGesture.view.superview];

  switch (panGesture.state) {
    case UIGestureRecognizerStateBegan: {
      _isDragging = YES;
      // Scale up slightly to indicate dragging with spring animation
      UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
          initWithDampingRatio:0.7
          initialVelocity:CGVectorMake(1.0, 1.0)];
      UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
          initWithDuration:0.15
          timingParameters:springParams];
      [animator addAnimations:^{
        self->_orangeButton.transform = CGAffineTransformMakeScale(1.1, 1.1);
      }];
      [animator startAnimation];
      break;
    }

    case UIGestureRecognizerStateChanged: {
      // Move the window to follow the gesture
      CGRect newFrame = _orangeMenuWindow.frame;
      newFrame.origin.x += translation.x;
      newFrame.origin.y += translation.y;

      // Keep button within screen bounds
      CGSize screenSize = [UIScreen mainScreen].bounds.size;
      newFrame.origin.x = MAX(0, MIN(newFrame.origin.x, screenSize.width - newFrame.size.width));
      newFrame.origin.y = MAX(0, MIN(newFrame.origin.y, screenSize.height - newFrame.size.height));

      _orangeMenuWindow.frame = newFrame;
      [panGesture setTranslation:CGPointZero inView:panGesture.view.superview];
      break;
    }

    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled: {
      _isDragging = NO;

      // Scale back to normal with spring animation
      UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
          initWithDampingRatio:0.65
          initialVelocity:CGVectorMake(0.5, 0.5)];
      UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
          initWithDuration:0.25
          timingParameters:springParams];
      [animator addAnimations:^{
        self->_orangeButton.transform = CGAffineTransformIdentity;
      }];
      [animator startAnimation];

      // Snap to edges with animation
      [self snapToNearestEdgeWithVelocity:velocity];
      break;
    }

    default:
      break;
  }
}

- (void)snapToNearestEdgeWithVelocity:(CGPoint)velocity
{
  CGSize screenSize = [UIScreen mainScreen].bounds.size;
  CGRect currentFrame = _orangeMenuWindow.frame;
  CGRect targetFrame = currentFrame;

  // Determine which edge to snap to based on position and velocity
  CGFloat centerX = CGRectGetMidX(currentFrame);
  CGFloat centerY = CGRectGetMidY(currentFrame);

  // Snap to left or right edge
  if (centerX < screenSize.width / 2) {
    targetFrame.origin.x = 0; // Snap to left edge
  } else {
    targetFrame.origin.x = screenSize.width - targetFrame.size.width; // Snap to right edge
  }

  // Keep current Y position but ensure it's within bounds
  targetFrame.origin.y = MAX(44, MIN(currentFrame.origin.y, screenSize.height - targetFrame.size.height - 44));

  // Save the new position
  _buttonPosition = targetFrame.origin;
  [self saveButtonPosition];

  // Animate to target position with UIViewPropertyAnimator for smooth 60fps spring
  // Use velocity from gesture for natural feel
  CGFloat velocityScale = 0.001; // Scale velocity to reasonable initial velocity
  CGVector initialVelocity = CGVectorMake(velocity.x * velocityScale, velocity.y * velocityScale);

  UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
      initWithDampingRatio:0.75
      initialVelocity:initialVelocity];

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:0.4
      timingParameters:springParams];

  [animator addAnimations:^{
    self->_orangeMenuWindow.frame = targetFrame;
  }];

  [animator startAnimation];
}

- (void)createAndShowButton
{
  // Clean up existing button and window
  if (_orangeButton) {
    [_orangeButton removeFromSuperview];
    _orangeButton = nil;
  }
  if (_orangeMenuWindow) {
    _orangeMenuWindow.hidden = YES;
    _orangeMenuWindow = nil;
  }
  
  // Create a dedicated window for the orange menu button
  // This ensures it appears above loading screens and other overlays
  CGFloat screenHeight = [UIScreen mainScreen].bounds.size.height;
  CGFloat screenWidth = [UIScreen mainScreen].bounds.size.width;
  
  // Create window using saved position - now circular 60x60
  _orangeMenuWindow = [[UIWindow alloc] initWithFrame:CGRectMake(_buttonPosition.x, _buttonPosition.y, 60, 60)];
  
  // Set window level dynamically based on dev menu visibility
  [self updateWindowLevel];
  _orangeMenuWindow.backgroundColor = [UIColor clearColor];
  _orangeMenuWindow.hidden = NO;
  
  // Create a simple view controller for the window
  UIViewController *orangeMenuVC = [[UIViewController alloc] init];
  orangeMenuVC.view.backgroundColor = [UIColor clearColor];
  _orangeMenuWindow.rootViewController = orangeMenuVC;
  
  // Create the button as a circular icon
  _orangeButton = [UIButton buttonWithType:UIButtonTypeCustom];
  _orangeButton.frame = CGRectMake(0, 0, 60, 60); // Make it square for circular design
  
  // Create clean circular button background for your icon
  _orangeButton.backgroundColor = [UIColor clearColor];
  _orangeButton.layer.cornerRadius = 30; // Half of width/height for perfect circle
  
  // Enhanced shadow for floating effect (matching your icon's gradient colors)
  _orangeButton.layer.shadowColor = [UIColor colorWithRed:0.6 green:0.3 blue:1.0 alpha:0.8].CGColor;
  _orangeButton.layer.shadowOffset = CGSizeMake(0, 6);
  _orangeButton.layer.shadowOpacity = 0.4;
  _orangeButton.layer.shadowRadius = 12;
  
  // Add your icon to fill the entire button
  UIImageView *iconImageView = [[UIImageView alloc] initWithFrame:_orangeButton.bounds];
  
  // Load your custom Vibra icon
  UIImage *appIcon = [UIImage imageNamed:@"VibraIcon"];
  if (!appIcon) {
    // Fallback to launch icon
    appIcon = [UIImage imageNamed:@"ExpoGoLaunchIcon"];
  }
  if (!appIcon) {
    // Fallback to system icon
    appIcon = [UIImage systemImageNamed:@"bolt.fill"];
  }
  
  iconImageView.image = appIcon;
  iconImageView.contentMode = UIViewContentModeScaleAspectFill; // Fill the entire button
  iconImageView.layer.cornerRadius = 30; // Match button's corner radius
  iconImageView.clipsToBounds = YES;
  iconImageView.userInteractionEnabled = NO;
  
  [_orangeButton addSubview:iconImageView];
  
  // Add tap action
  [_orangeButton addTarget:self action:@selector(buttonPressed) forControlEvents:UIControlEventTouchUpInside];
  
  // Add pan gesture recognizer for dragging
  _panGestureRecognizer = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePanGesture:)];
  _panGestureRecognizer.minimumNumberOfTouches = 1;
  _panGestureRecognizer.maximumNumberOfTouches = 1;
  [_orangeButton addGestureRecognizer:_panGestureRecognizer];
  
  // Add button to the window's view controller
  [orangeMenuVC.view addSubview:_orangeButton];
}

- (void)removeButton
{
  if (_orangeButton) {
    [_orangeButton removeFromSuperview];
    _orangeButton = nil;
  }
  if (_orangeMenuWindow) {
    _orangeMenuWindow.hidden = YES;
    _orangeMenuWindow = nil;
  }
}

- (void)buttonPressed
{
  // Only toggle zoom if not dragging
  if (!_isDragging) {
    [[EXPreviewZoomManager sharedInstance] toggleZoom];
  }
}

- (RCTReactNativeFactory *)mainAppFactory
{
  return [_delegate appDelegateForOrangeMenuManager:self];
}

@end