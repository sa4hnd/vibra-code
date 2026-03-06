// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomView.h"

@interface EXPreviewZoomView ()

@property (nonatomic, strong) UIView *previewContainerView;
@property (nonatomic, strong) UITapGestureRecognizer *tapGestureRecognizer;
@property (nonatomic, strong) UITapGestureRecognizer *superviewTapGesture;
@property (nonatomic, strong) UIColor *originalSuperviewBackgroundColor;
@property (nonatomic, weak) UIView *observedContentView;
@property (nonatomic, strong) UIView *storedSuperview;
@property (nonatomic, assign) BOOL isZoomed;

@end

@implementation EXPreviewZoomView

- (instancetype)init
{
  if (self = [super init]) {
    _isZoomed = NO;
    _originalPreviewTransform = CATransform3DIdentity;
  }
  return self;
}

- (BOOL)isIPad
{
  return UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad;
}

- (void)zoomOutWithContentView:(UIView *)contentView
                      superview:(UIView *)superview
                     completion:(void (^)(void))completion
{
  if (_isZoomed) {
    return; // Already zoomed out
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window || !superview || !contentView) {
    return;
  }

  // Force layout to ensure safe area insets are calculated correctly
  [window layoutIfNeeded];
  if (window.rootViewController && window.rootViewController.view) {
    [window.rootViewController.view layoutIfNeeded];
  }
  [superview layoutIfNeeded];

  _isZoomed = YES;
  
  // Store references for contentView replacement handling
  _observedContentView = contentView;
  _storedSuperview = superview;
  
  // Save original superview background color and set it to darker gray
  _originalSuperviewBackgroundColor = superview.backgroundColor;
  superview.backgroundColor = [UIColor colorWithRed:0.1 green:0.1 blue:0.1 alpha:1.0];

  // Create container view with dark gray background and rounded corners
  if (!_previewContainerView) {
    CGRect contentFrame = contentView.frame;
    _previewContainerView = [[UIView alloc] initWithFrame:contentFrame];
    _previewContainerView.backgroundColor = [UIColor colorWithRed:0.12 green:0.12 blue:0.12 alpha:1.0];
    _previewContainerView.layer.cornerRadius = 20.0;
    _previewContainerView.layer.masksToBounds = YES;
    _previewContainerView.clipsToBounds = YES;
    
    // Insert container behind contentView
    [superview insertSubview:_previewContainerView belowSubview:contentView];
    
    // Wrap contentView: move it into container and adjust frame
    CGRect bounds = contentView.bounds;
    [contentView removeFromSuperview];
    contentView.frame = bounds;
    [_previewContainerView addSubview:contentView];
  }
  
  // Ensure contentView has rounded corners
  contentView.layer.cornerRadius = 20.0;
  contentView.layer.masksToBounds = YES;
  contentView.clipsToBounds = YES;
  
  // Add tap gesture recognizer to container view to detect taps for zoom in
  if (!_tapGestureRecognizer) {
    _tapGestureRecognizer = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap:)];
    _tapGestureRecognizer.numberOfTapsRequired = 1;
  }
  if (![_previewContainerView.gestureRecognizers containsObject:_tapGestureRecognizer]) {
    [_previewContainerView addGestureRecognizer:_tapGestureRecognizer];
  }
  
  // Add tap gesture recognizer to superview to detect taps on empty space (dismiss keyboard)
  if (!_superviewTapGesture) {
    _superviewTapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleSuperviewTap:)];
    _superviewTapGesture.numberOfTapsRequired = 1;
    _superviewTapGesture.cancelsTouchesInView = NO;
  }
  if (![superview.gestureRecognizers containsObject:_superviewTapGesture]) {
    [superview addGestureRecognizer:_superviewTapGesture];
  }

  // Apply 3D transform with scale only (no tilt)
  CATransform3D transform = CATransform3DIdentity;
  CGFloat scale = [self isIPad] ? 0.68 : 0.55;
  transform = CATransform3DScale(transform, scale, scale, 1.0);

  [UIView animateWithDuration:0.35
                        delay:0
       usingSpringWithDamping:0.8
        initialSpringVelocity:0.5
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
                     self->_previewContainerView.layer.transform = transform;
                   }
                   completion:^(BOOL finished) {
                     if (completion) {
                       completion();
                     }
                   }];
}

- (void)zoomInWithContentView:(UIView *)contentView
                    superview:(UIView *)superview
                   completion:(void (^)(void))completion
{
  if (!_isZoomed) {
    if (completion) {
      completion();
    }
    return;
  }

  UIView *originalSuperview = _previewContainerView ? _previewContainerView.superview : superview;
  _isZoomed = NO;
  
  // Clear stored references
  _observedContentView = nil;
  _storedSuperview = nil;

  // Remove tap gesture recognizers
  if (_tapGestureRecognizer && _previewContainerView) {
    [_previewContainerView removeGestureRecognizer:_tapGestureRecognizer];
  }
  if (_superviewTapGesture && originalSuperview) {
    [originalSuperview removeGestureRecognizer:_superviewTapGesture];
    _superviewTapGesture = nil;
  }

  // Restore original superview background color
  if (originalSuperview && _originalSuperviewBackgroundColor) {
    originalSuperview.backgroundColor = _originalSuperviewBackgroundColor;
  }

  // Restore to identity transform and remove rounded corners
  [UIView animateWithDuration:0.35
                        delay:0
       usingSpringWithDamping:0.8
        initialSpringVelocity:0.5
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
                     if (self->_previewContainerView) {
                       self->_previewContainerView.layer.transform = CATransform3DIdentity;
                       self->_previewContainerView.layer.cornerRadius = 0.0;
                     }
                     if (contentView) {
                       contentView.layer.cornerRadius = 0.0;
                     }
                   }
                   completion:^(BOOL finished) {
                     // Move contentView back to original superview and remove container
                     if (self->_previewContainerView && originalSuperview && contentView) {
                       CGRect containerFrame = self->_previewContainerView.frame;
                       [contentView removeFromSuperview];
                       contentView.frame = containerFrame;
                       [originalSuperview addSubview:contentView];
                       [self->_previewContainerView removeFromSuperview];
                       self->_previewContainerView = nil;
                     }
                     if (completion) {
                       completion();
                     }
                   }];
}

- (void)handleContentViewReplacement:(UIView *)newContentView
{
  if (!_isZoomed) {
    return;
  }
  
  // Clean up preview container
  if (_previewContainerView) {
    [_previewContainerView removeFromSuperview];
    _previewContainerView = nil;
  }
  
  if (_superviewTapGesture && _storedSuperview) {
    [_storedSuperview removeGestureRecognizer:_superviewTapGesture];
    _superviewTapGesture = nil;
  }
  
  _tapGestureRecognizer = nil;
  _observedContentView = nil;
  _isZoomed = NO;
}

- (void)reapplyBackgroundColor
{
  if (_isZoomed && _storedSuperview) {
    _storedSuperview.backgroundColor = [UIColor colorWithRed:0.1 green:0.1 blue:0.1 alpha:1.0];
  }
}

- (void)cleanup
{
  if (_previewContainerView) {
    [_previewContainerView removeFromSuperview];
    _previewContainerView = nil;
  }
  
  if (_superviewTapGesture && _storedSuperview) {
    [_storedSuperview removeGestureRecognizer:_superviewTapGesture];
    _superviewTapGesture = nil;
  }
  
  _tapGestureRecognizer = nil;
  _observedContentView = nil;
  _storedSuperview = nil;
  _isZoomed = NO;
}

- (void)updateTransformForKeyboardHeight:(CGFloat)keyboardHeight
{
  if (!_previewContainerView || !_isZoomed) {
    return;
  }
  
  // Store original transform if not already stored
  if (CATransform3DIsIdentity(_originalPreviewTransform)) {
    _originalPreviewTransform = _previewContainerView.layer.transform;
  }
  
  CATransform3D previewTransform = _originalPreviewTransform;
  if (!CATransform3DIsIdentity(_originalPreviewTransform)) {
    // Translate up and scale down more
    previewTransform = CATransform3DTranslate(_originalPreviewTransform, 0, -keyboardHeight, 0);
    CGFloat additionalScale = 0.35 / 0.55;
    previewTransform = CATransform3DScale(previewTransform, additionalScale, additionalScale, 1.0);
  }
  
  _previewContainerView.layer.transform = previewTransform;
}

- (void)restoreTransform
{
  if (!_previewContainerView || !_isZoomed) {
    return;
  }

  CATransform3D originalTransform = _originalPreviewTransform;
  if (CATransform3DIsIdentity(_originalPreviewTransform)) {
    // Reconstruct the zoom transform with responsive values (no tilt)
    CATransform3D fallbackTransform = CATransform3DIdentity;
    CGFloat scale = [self isIPad] ? 0.68 : 0.55;
    fallbackTransform = CATransform3DScale(fallbackTransform, scale, scale, 1.0);
    originalTransform = fallbackTransform;
  }

  _previewContainerView.layer.transform = originalTransform;
}

#pragma mark - Gesture Handlers

- (void)handleTap:(UITapGestureRecognizer *)gestureRecognizer
{
  if (!_isZoomed) {
    return;
  }
  
  if ([self.delegate respondsToSelector:@selector(previewZoomViewDidRequestZoomIn)]) {
    [self.delegate previewZoomViewDidRequestZoomIn];
  }
}

- (void)handleSuperviewTap:(UITapGestureRecognizer *)gestureRecognizer
{
  if (!_isZoomed) {
    return;
  }
  
  CGPoint tapLocation = [gestureRecognizer locationInView:gestureRecognizer.view];
  
  // Check if tap is on preview container - if so, let preview handle it
  if (_previewContainerView && CGRectContainsPoint(_previewContainerView.frame, tapLocation)) {
    return;
  }
  
  if ([self.delegate respondsToSelector:@selector(previewZoomViewDidRequestDismissKeyboard)]) {
    [self.delegate previewZoomViewDidRequestDismissKeyboard];
  }
}

@end

