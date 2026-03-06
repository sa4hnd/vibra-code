// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager.h"
#import "EXPreviewZoomManager+Private.h"
#import "EXWebPreviewView.h"

@implementation EXPreviewZoomManager (WebPreview)

#pragma mark - Web Project Loading

- (void)loadWebProject:(NSURL *)webUrl
{
  if (!webUrl) return;

  self.webPreviewURL = webUrl;
  self.projectType = @"web";

  // If already zoomed with a web preview, just reload the URL
  if (self.isZoomed && self.webPreviewView) {
    EXWebPreviewView *webView = (EXWebPreviewView *)self.webPreviewView;
    [webView loadURL:webUrl];
    return;
  }

  // Otherwise trigger zoom out with web preview
  [self zoomOutWebPreview];
}

#pragma mark - Web Preview Zoom

- (void)zoomOutWebPreview
{
  if (self.isZoomed) {
    return; // Already zoomed out
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window || !window.rootViewController) {
    return;
  }

  UIView *rootView = window.rootViewController.view;
  if (!rootView) {
    return;
  }

  // Force layout to ensure safe area insets are calculated correctly
  [window layoutIfNeeded];
  [rootView layoutIfNeeded];

  self.isZoomed = YES;
  self.isWebProject = YES;

  // Save original background color
  self.originalSuperviewBackgroundColor = rootView.backgroundColor;
  rootView.backgroundColor = [UIColor colorWithRed:0.1 green:0.1 blue:0.1 alpha:1.0];

  // Store superview reference
  self.storedSuperview = rootView;

  // Create container view
  CGRect containerFrame = rootView.bounds;
  // Inset for visual appearance
  CGFloat horizontalInset = [self isIPad] ? 40 : 20;
  CGFloat topInset = [self isIPad] ? 100 : 80;
  CGFloat bottomInset = [self isIPad] ? 180 : 140;

  containerFrame = CGRectInset(containerFrame, horizontalInset, 0);
  containerFrame.origin.y = topInset;
  containerFrame.size.height = containerFrame.size.height - topInset - bottomInset;

  self.previewContainerView = [[UIView alloc] initWithFrame:containerFrame];
  self.previewContainerView.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
  CGFloat cornerRadius = [self responsiveCornerRadius:20.0];
  self.previewContainerView.layer.cornerRadius = cornerRadius;
  self.previewContainerView.layer.masksToBounds = YES;
  self.previewContainerView.clipsToBounds = YES;

  [rootView addSubview:self.previewContainerView];

  // Create web preview view
  EXWebPreviewView *webPreviewView = [[EXWebPreviewView alloc] initWithFrame:self.previewContainerView.bounds];
  webPreviewView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self.previewContainerView addSubview:webPreviewView];
  self.webPreviewView = webPreviewView;

  // Load the URL
  if (self.webPreviewURL) {
    [webPreviewView loadURL:self.webPreviewURL];
  }

  // Add tap gesture recognizer to container view
  if (!self.tapGestureRecognizer) {
    self.tapGestureRecognizer = [[UITapGestureRecognizer alloc] initWithTarget:self
                                                                        action:@selector(handleTap:)];
    self.tapGestureRecognizer.numberOfTapsRequired = 1;
  }
  [self.previewContainerView addGestureRecognizer:self.tapGestureRecognizer];

  // Add tap gesture to superview for dismissing keyboard
  if (!self.superviewTapGesture) {
    self.superviewTapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self
                                                                        action:@selector(handleSuperviewTap:)];
    self.superviewTapGesture.numberOfTapsRequired = 1;
    self.superviewTapGesture.cancelsTouchesInView = NO;
  }
  [rootView addGestureRecognizer:self.superviewTapGesture];

  // Create and add top bar
  if (!self.topBarView) {
    self.topBarView = [self createTopBarView:rootView];
    if (self.topBarView) {
      [rootView bringSubviewToFront:self.topBarView];
      self.topBarView.layer.zPosition = 900.0;
      self.topBarView.alpha = 0.0;
      CGRect topBarFrame = self.topBarView.frame;
      self.topBarView.transform = CGAffineTransformMakeTranslation(0, -topBarFrame.size.height);
    }
  }

  // Create and add bottom bar
  if (!self.bottomBarView) {
    self.bottomBarView = [self createBottomBarView:rootView];
    if (self.bottomBarView) {
      [rootView bringSubviewToFront:self.bottomBarView];
      self.bottomBarView.layer.zPosition = 1000.0;

      UITapGestureRecognizer *bottomBarTapGesture = [[UITapGestureRecognizer alloc]
          initWithTarget:self
                  action:@selector(handleBottomBarTap:)];
      bottomBarTapGesture.numberOfTapsRequired = 1;
      bottomBarTapGesture.cancelsTouchesInView = NO;
      bottomBarTapGesture.delaysTouchesBegan = NO;
      bottomBarTapGesture.delaysTouchesEnded = NO;
      [self.bottomBarView addGestureRecognizer:bottomBarTapGesture];

      [rootView layoutIfNeeded];
      self.bottomBarView.alpha = 0.0;
      CGRect barFrame = self.bottomBarView.frame;
      self.bottomBarView.transform = CGAffineTransformMakeTranslation(0, barFrame.size.height);

      // Pre-load session
      if ([self respondsToSelector:@selector(lookupSessionAndLoadMessagesWithErrorHandler:)]) {
        [self performSelector:@selector(lookupSessionAndLoadMessagesWithErrorHandler:) withObject:nil];
      }
    }
  }

  // Apply 3D transform (no tilt)
  CATransform3D transform = CATransform3DIdentity;
  CGFloat scale = [self isIPad] ? 0.68 : 0.55;
  transform = CATransform3DScale(transform, scale, scale, 1.0);
  CGFloat translateY = [self isIPad] ? -120.0 : -60.0;
  transform = CATransform3DTranslate(transform, 0, translateY, 0);

  // Animate
  [UIView animateWithDuration:0.35
                        delay:0
       usingSpringWithDamping:0.8
        initialSpringVelocity:0.5
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
                     self.previewContainerView.layer.transform = transform;
                     if (self.bottomBarView) {
                       self.bottomBarView.alpha = 1.0;
                       self.bottomBarView.transform = CGAffineTransformIdentity;
                     }
                     if (self.topBarView) {
                       self.topBarView.alpha = 1.0;
                       self.topBarView.transform = CGAffineTransformIdentity;
                     }
                   }
                   completion:^(BOOL finished) {
                     if (self.isAgentRunning) {
                       dispatch_async(dispatch_get_main_queue(), ^{
                         [self updateSendButtonForAgentState];
                       });
                     }
                   }];
}

#pragma mark - Web Preview Cleanup

- (void)cleanupWebPreview
{
  if (self.webPreviewView) {
    EXWebPreviewView *webView = (EXWebPreviewView *)self.webPreviewView;
    [webView stopLoading];
    [webView removeFromSuperview];
    self.webPreviewView = nil;
  }

  self.webPreviewURL = nil;
  self.isWebProject = NO;
  self.projectType = @"mobile";
}

@end
