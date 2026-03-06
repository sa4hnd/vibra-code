// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager.h"
#import "EXPreviewZoomManager+Private.h"

@implementation EXPreviewZoomManager

@synthesize isZoomed = _isZoomed;
@synthesize isChatMode = _isChatMode;
@synthesize isAnimating = _isAnimating;
@synthesize previewContainerView = _previewContainerView;
@synthesize needsZoomAfterReload = _needsZoomAfterReload;
@synthesize projectType = _projectType;
@synthesize isWebProject = _isWebProject;
@synthesize webPreviewURL = _webPreviewURL;
@synthesize webPreviewView = _webPreviewView;

#pragma mark - Initialization & Singleton

+ (instancetype)sharedInstance
{
  static EXPreviewZoomManager *manager;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    manager = [EXPreviewZoomManager new];
  });
  return manager;
}

- (instancetype)init
{
  if (self = [super init]) {
    _isZoomed = NO;
    _needsZoomAfterReload = NO;
    _isChatMode = NO;
    _isAnimating = NO; // Prevents duplicate bars on rapid toggle
    _originalPreviewTransform = CATransform3DIdentity; // Initialize transform
    _canSendMessage = YES; // Default to YES (fail-open) until billing check completes
    _billingMode = @"tokens"; // Default billing mode
    _projectType = @"mobile"; // Default to mobile
    _isWebProject = NO;

    // Add keyboard observers
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardWillShow:)
                                                 name:UIKeyboardWillShowNotification
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(keyboardWillHide:)
                                                 name:UIKeyboardWillHideNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  // Remove keyboard observers
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (BOOL)isZoomed
{
  return _isZoomed;
}

- (void)setIsZoomed:(BOOL)isZoomed
{
  _isZoomed = isZoomed;
}

#pragma mark - Project Type Accessors

- (void)setProjectType:(NSString *)projectType
{
  _projectType = projectType;
  _isWebProject = [projectType isEqualToString:@"web"];
}

- (NSString *)projectType
{
  return _projectType ?: @"mobile";
}

- (BOOL)isWebPreview
{
  return _isWebProject;
}

- (UIView *)previewContainerView
{
  return _previewContainerView;
}

#pragma mark - Public API

- (void)toggleZoom
{
  // Prevent rapid toggling that causes duplicate bars
  if (_isAnimating) {
    NSLog(@"🔵 [ZoomManager] toggleZoom - animation in progress, ignoring");
    return;
  }

  if (_isZoomed) {
    [self zoomIn];
  } else {
    [self zoomOut];
  }
}

- (BOOL)needsZoomAfterReload
{
  return _needsZoomAfterReload;
}

- (void)setNeedsZoomAfterReload:(BOOL)needsZoom
{
  _needsZoomAfterReload = needsZoom;
}

#pragma mark - Device Detection

- (BOOL)isIPad
{
  return UI_USER_INTERFACE_IDIOM() == UIUserInterfaceIdiomPad;
}

#pragma mark - Responsive Layout Helpers

- (CGFloat)responsiveValueForPhone:(CGFloat)phoneValue iPad:(CGFloat)iPadValue
{
  return [self isIPad] ? iPadValue : phoneValue;
}

- (CGFloat)responsiveFontSize:(CGFloat)baseSize
{
  // iPad gets ~20% larger fonts for better readability
  return [self isIPad] ? baseSize * 1.2 : baseSize;
}

- (CGFloat)responsivePadding:(CGFloat)baseValue
{
  // iPad gets ~50% more padding for better spacing
  return [self isIPad] ? baseValue * 1.5 : baseValue;
}

- (CGFloat)responsiveIconSize:(CGFloat)baseSize
{
  // iPad gets ~20% larger icons
  return [self isIPad] ? baseSize * 1.2 : baseSize;
}

- (CGFloat)responsiveCornerRadius:(CGFloat)baseValue
{
  // iPad gets ~40% larger corner radius
  return [self isIPad] ? baseValue * 1.4 : baseValue;
}

- (CGFloat)responsiveButtonSize:(CGFloat)baseSize
{
  // iPad gets ~25% larger touch targets
  return [self isIPad] ? baseSize * 1.25 : baseSize;
}

- (CGFloat)responsiveBarHeight:(CGFloat)baseHeight
{
  // iPad gets ~27% larger bar heights (44 -> 56, 36 -> 46)
  return [self isIPad] ? baseHeight * 1.27 : baseHeight;
}

@end
