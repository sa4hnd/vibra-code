#import "EXAppLoadingProgressWindowController.h"

#import <ExpoModulesCore/EXDefines.h>

#import "Expo_Go-Swift.h"

#import "EXUtil.h"

@interface EXAppLoadingProgressWindowController ()

@property (nonatomic, assign) BOOL enabled;
@property (nonatomic, strong) UIWindow *window;
@property (nonatomic, strong) UILabel *textLabel;
@property (nonatomic, strong) CALayer *progressBackgroundLayer;
@property (nonatomic, strong) CALayer *progressFillLayer;

@end

@implementation EXAppLoadingProgressWindowController

- (instancetype)initWithEnabled:(BOOL)enabled
{
  if (self = [super init]) {
    _enabled = enabled;
  }
  return self;
}

- (void)show
{
  if (!_enabled) {
    return;
  }

  EX_WEAKIFY(self);
  dispatch_async(dispatch_get_main_queue(), ^{
    EX_ENSURE_STRONGIFY(self);
    if (!self.window) {
      CGSize screenSize = [UIScreen mainScreen].bounds.size;

      int bottomInsets = EXSharedApplication().keyWindow.safeAreaInsets.bottom;
      self.window = [[UIWindow alloc] initWithFrame:CGRectMake(0,
                                                               screenSize.height - 36 - bottomInsets,
                                                               screenSize.width,
                                                               36 + bottomInsets)];
      self.window.windowLevel = UIWindowLevelStatusBar - 1;
      self.window.rootViewController = [EXAppLoadingProgressWindowViewController new];
      // Vibra Design: Match HomeScreenView gradient background
      self.window.backgroundColor = [UIColor clearColor];
      
      // Add Vibra gradient background matching HomeScreenView
      CAGradientLayer *vibeGradientLayer = [CAGradientLayer layer];
      vibeGradientLayer.frame = CGRectMake(0, 0, screenSize.width, 36 + bottomInsets);
      vibeGradientLayer.colors = @[
        (id)[UIColor colorWithRed:0.039 green:0.039 blue:0.059 alpha:1.0].CGColor, // #0A0A0F
        (id)[UIColor colorWithRed:0.102 green:0.102 blue:0.125 alpha:1.0].CGColor, // #1A1A20
        (id)[UIColor colorWithRed:0.165 green:0.165 blue:0.208 alpha:1.0].CGColor, // #2A2A35
        (id)[UIColor colorWithRed:0.102 green:0.102 blue:0.125 alpha:1.0].CGColor, // #1A1A20
        (id)[UIColor colorWithRed:0.039 green:0.039 blue:0.059 alpha:1.0].CGColor  // #0A0A0F
      ];
      vibeGradientLayer.startPoint = CGPointMake(0, 0);
      vibeGradientLayer.endPoint = CGPointMake(1, 1);
      vibeGradientLayer.locations = @[@0.0, @0.2, @0.5, @0.8, @1.0];
      [self.window.layer insertSublayer:vibeGradientLayer atIndex:0];
      
      // Add glass morphism overlay
      CALayer *glassOverlay = [CALayer layer];
      glassOverlay.frame = vibeGradientLayer.frame;
      glassOverlay.backgroundColor = [UIColor colorWithRed:0.541 green:0.169 blue:0.886 alpha:0.02].CGColor; // Purple tint
      [self.window.layer insertSublayer:glassOverlay atIndex:1];

      UIView *containerView = [UIView new];
      containerView.backgroundColor = [UIColor clearColor];  // Transparent to show gradient
      [self.window addSubview:containerView];
      
      // Create dynamic progress bar background layer with Vibra colors
      self.progressBackgroundLayer = [CALayer layer];
      self.progressBackgroundLayer.frame = CGRectMake(0, 0, screenSize.width, 4); // Slightly thicker
      self.progressBackgroundLayer.backgroundColor = [UIColor colorWithRed:0.165 green:0.165 blue:0.208 alpha:0.3].CGColor; // Vibra medium neutral
      self.progressBackgroundLayer.cornerRadius = 2;
      [containerView.layer addSublayer:self.progressBackgroundLayer];
      
      // Create dynamic progress fill layer with Vibra primary gradient
      self.progressFillLayer = [CALayer layer];
      self.progressFillLayer.frame = CGRectMake(0, 0, 0, 4);  // Start with 0 width, thicker
      self.progressFillLayer.cornerRadius = 2;
      
      // Add gradient to progress bar matching cosmic design
      CAGradientLayer *progressGradient = [CAGradientLayer layer];
      progressGradient.frame = CGRectMake(0, 0, screenSize.width, 4);
      progressGradient.colors = @[
        (id)[UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0].CGColor, // #F5F5F7 (white)
        (id)[UIColor colorWithRed:0.8 green:0.8 blue:0.8 alpha:1.0].CGColor        // #CCCCCC (light gray)
      ];
      progressGradient.startPoint = CGPointMake(0, 0);
      progressGradient.endPoint = CGPointMake(1, 0);
      progressGradient.cornerRadius = 2;
      
      // Add subtle glow effect with neutral colors
      progressGradient.shadowColor = [UIColor colorWithRed:0.8 green:0.8 blue:0.8 alpha:0.6].CGColor;
      progressGradient.shadowOffset = CGSizeMake(0, 0);
      progressGradient.shadowRadius = 4;
      progressGradient.shadowOpacity = 0.4;
      
      [containerView.layer addSublayer:progressGradient];
      self.progressFillLayer = progressGradient; // Use gradient as fill layer

      self.textLabel = [UILabel new];
      self.textLabel.frame = CGRectMake(20, 8, screenSize.width - 40, 28);
      self.textLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightBold]; // Vibra typography
      self.textLabel.textAlignment = NSTextAlignmentCenter;
      self.textLabel.textColor = [UIColor colorWithRed:0.961 green:0.961 blue:0.969 alpha:1.0]; // #F5F5F7 (Vibra text)
      self.textLabel.backgroundColor = [UIColor clearColor];
      
      // Enhanced text shadow matching cosmic design system
      self.textLabel.layer.shadowColor = [UIColor colorWithRed:0.0 green:0.0 blue:0.0 alpha:0.5].CGColor; // Black shadow
      self.textLabel.layer.shadowOffset = CGSizeMake(0, 1);
      self.textLabel.layer.shadowRadius = 3;
      self.textLabel.layer.shadowOpacity = 0.6;
      
      [containerView addSubview:self.textLabel];
    }
    self.textLabel.text = @"Initializing...";
    self.window.hidden = NO;
  });
}

- (void)hide
{
  if (!_enabled) {
    return;
  }

  EX_WEAKIFY(self);
  dispatch_async(dispatch_get_main_queue(), ^{
    EX_ENSURE_STRONGIFY(self);
    if (self.window) {
      self.window.hidden = YES;
      // remove this window altogther to hand over the command over StatusBar rotation
      self.window = nil;
    }
  });
}

- (void)updateStatusWithProgress:(EXLoadingProgress *)progress
{
  if (!_enabled) {
    return;
  }

  [self show];

  EX_WEAKIFY(self);
  dispatch_async(dispatch_get_main_queue(), ^{
    EX_ENSURE_STRONGIFY(self);
    float progressPercent = ([progress.done floatValue] / [progress.total floatValue]);
    // Clean progress messaging following Vibra design language
    NSString *enhancedStatus = progress.status;
    
    if ([progress.status containsString:@"Downloading"]) {
      enhancedStatus = @"Downloading assets";
    } else if ([progress.status containsString:@"Building"]) {
      enhancedStatus = @"Building bundle";
    } else if ([progress.status containsString:@"Starting"]) {
      enhancedStatus = @"Starting application";
    } else if ([progress.status containsString:@"Loading"]) {
      enhancedStatus = @"Loading resources";
    }
    
    // Update progress bar width smoothly
    [self updateProgressBar:progressPercent];
    
    // Clean, professional text display
    self.textLabel.text = [NSString stringWithFormat:@"%@ • %.0f%%", enhancedStatus, progressPercent * 100];
    [self.textLabel setNeedsDisplay];

    // TODO: (@bbarthec) maybe it's better to show/hide this based on other thing than progress status reported by the fetcher?
    self.window.hidden = !(progress.total.floatValue > 0);
  });
}

- (void)updateStatus:(EXAppLoaderRemoteUpdateStatus)status
{
  if (!_enabled) {
    return;
  }

  NSString *statusText = [[self class] _loadingViewTextForStatus:status];
  if (!statusText) {
    return;
  }

  [self show];

  EX_WEAKIFY(self);
  dispatch_async(dispatch_get_main_queue(), ^{
    EX_ENSURE_STRONGIFY(self);
    self.textLabel.text = statusText;
    [self.textLabel setNeedsDisplay];
  });
}

+ (nullable NSString *)_loadingViewTextForStatus:(EXAppLoaderRemoteUpdateStatus)status
{
  if (status == kEXAppLoaderRemoteUpdateStatusChecking) {
    return @"Checking for updates...";
  } else if (status == kEXAppLoaderRemoteUpdateStatusDownloading) {
    return @"Downloading update...";
  } else {
    return nil;
  }
}

- (NSString *)createProgressBar:(float)progress {
  // This method is no longer used - we use visual progress bar instead
  return @"";
}

- (void)updateProgressBar:(float)progress {
  if (!self.progressFillLayer || !self.progressBackgroundLayer) {
    return;
  }

  // Animate progress bar smoothly following Vibra design patterns
  CGFloat screenWidth = [UIScreen mainScreen].bounds.size.width;
  CGFloat targetWidth = screenWidth * progress;

  [CATransaction begin];
  [CATransaction setAnimationDuration:0.3];
  [CATransaction setAnimationTimingFunction:[CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut]];

  // Update progress fill width
  CGRect frame = self.progressFillLayer.frame;
  frame.size.width = targetWidth;
  self.progressFillLayer.frame = frame;

  [CATransaction commit];
}

@end
