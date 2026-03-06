// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import "EXChatBackendService.h"
#import "EXAudioRecorderService.h"
#import "EXAssemblyAIService.h"
#import "EXAudioWaveformView.h"
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <PhotosUI/PhotosUI.h>
#import <AVFoundation/AVFoundation.h>
#import <FBSDKCoreKit/FBSDKCoreKit.h>

// Forward declarations for iOS 26.0+ APIs
// These APIs are available in iOS 26.0 SDK but may not be in headers yet

// Category to add iOS 26.0+ methods to UIButtonConfiguration
@interface UIButtonConfiguration (iOS26)
+ (instancetype)glass API_AVAILABLE(ios(26.0));
+ (instancetype)prominentGlass API_AVAILABLE(ios(26.0));
@end

// Helper function to create Claude icon image from SVG path
static UIImage *createClaudeIconImage(CGFloat size, UIColor *color) {
  CGRect rect = CGRectMake(0, 0, size, size);
  UIGraphicsBeginImageContextWithOptions(rect.size, NO, 0);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // Scale to fit the size (SVG is 24x24)
  CGFloat scale = size / 24.0;
  CGContextScaleCTM(context, scale, scale);

  // Create the path from SVG data
  UIBezierPath *path = [UIBezierPath bezierPath];

  // Claude logo path (from SVG)
  [path moveToPoint:CGPointMake(4.709, 15.955)];
  [path addLineToPoint:CGPointMake(9.429, 13.308)];
  [path addLineToPoint:CGPointMake(9.509, 13.078)];
  [path addLineToPoint:CGPointMake(9.429, 12.950)];
  [path addLineToPoint:CGPointMake(9.2, 12.950)];
  [path addLineToPoint:CGPointMake(8.41, 12.902)];
  [path addLineToPoint:CGPointMake(5.712, 12.829)];
  [path addLineToPoint:CGPointMake(3.373, 12.732)];
  [path addLineToPoint:CGPointMake(1.107, 12.610)];
  [path addLineToPoint:CGPointMake(0.536, 12.489)];
  [path addLineToPoint:CGPointMake(0, 11.784)];
  [path addLineToPoint:CGPointMake(0.055, 11.432)];
  [path addLineToPoint:CGPointMake(0.535, 11.111)];
  [path addLineToPoint:CGPointMake(1.221, 11.171)];
  [path addLineToPoint:CGPointMake(2.741, 11.274)];
  [path addLineToPoint:CGPointMake(5.019, 11.432)];
  [path addLineToPoint:CGPointMake(6.671, 11.529)];
  [path addLineToPoint:CGPointMake(9.12, 11.784)];
  [path addLineToPoint:CGPointMake(9.509, 11.784)];
  [path addLineToPoint:CGPointMake(9.564, 11.627)];
  [path addLineToPoint:CGPointMake(9.43, 11.529)];
  [path addLineToPoint:CGPointMake(9.327, 11.432)];
  [path addLineToPoint:CGPointMake(6.969, 9.836)];
  [path addLineToPoint:CGPointMake(4.417, 8.148)];
  [path addLineToPoint:CGPointMake(3.081, 7.176)];
  [path addLineToPoint:CGPointMake(2.357, 6.685)];
  [path addLineToPoint:CGPointMake(1.993, 6.223)];
  [path addLineToPoint:CGPointMake(1.835, 5.215)];
  [path addLineToPoint:CGPointMake(2.491, 4.493)];
  [path addLineToPoint:CGPointMake(3.372, 4.553)];
  [path addLineToPoint:CGPointMake(3.597, 4.614)];
  [path addLineToPoint:CGPointMake(4.49, 5.3)];
  [path addLineToPoint:CGPointMake(6.398, 6.776)];
  [path addLineToPoint:CGPointMake(8.889, 8.609)];
  [path addLineToPoint:CGPointMake(9.254, 8.913)];
  [path addLineToPoint:CGPointMake(9.399, 8.81)];
  [path addLineToPoint:CGPointMake(9.418, 8.737)];
  [path addLineToPoint:CGPointMake(9.254, 8.463)];
  [path addLineToPoint:CGPointMake(7.899, 6.017)];
  [path addLineToPoint:CGPointMake(6.453, 3.527)];
  [path addLineToPoint:CGPointMake(5.809, 2.495)];
  [path addLineToPoint:CGPointMake(5.639, 1.876)];
  [path addLineToPoint:CGPointMake(5.535, 1.147)];
  [path addLineToPoint:CGPointMake(6.283, 0.134)];
  [path addLineToPoint:CGPointMake(6.696, 0)];
  [path addLineToPoint:CGPointMake(7.692, 0.134)];
  [path addLineToPoint:CGPointMake(8.112, 0.498)];
  [path addLineToPoint:CGPointMake(8.732, 1.912)];
  [path addLineToPoint:CGPointMake(9.734, 4.141)];
  [path addLineToPoint:CGPointMake(11.289, 7.171)];
  [path addLineToPoint:CGPointMake(11.745, 8.069)];
  [path addLineToPoint:CGPointMake(11.988, 8.901)];
  [path addLineToPoint:CGPointMake(12.079, 9.156)];
  [path addLineToPoint:CGPointMake(12.237, 9.156)];
  [path addLineToPoint:CGPointMake(12.237, 9.01)];
  [path addLineToPoint:CGPointMake(12.365, 7.304)];
  [path addLineToPoint:CGPointMake(12.602, 5.209)];
  [path addLineToPoint:CGPointMake(12.832, 2.514)];
  [path addLineToPoint:CGPointMake(12.912, 1.754)];
  [path addLineToPoint:CGPointMake(13.288, 0.844)];
  [path addLineToPoint:CGPointMake(14.035, 0.352)];
  [path addLineToPoint:CGPointMake(14.619, 0.632)];
  [path addLineToPoint:CGPointMake(15.099, 1.317)];
  [path addLineToPoint:CGPointMake(15.032, 1.761)];
  [path addLineToPoint:CGPointMake(14.746, 3.612)];
  [path addLineToPoint:CGPointMake(14.187, 6.515)];
  [path addLineToPoint:CGPointMake(13.823, 8.457)];
  [path addLineToPoint:CGPointMake(14.035, 8.457)];
  [path addLineToPoint:CGPointMake(14.278, 8.215)];
  [path addLineToPoint:CGPointMake(15.263, 6.909)];
  [path addLineToPoint:CGPointMake(16.915, 4.845)];
  [path addLineToPoint:CGPointMake(17.645, 4.025)];
  [path addLineToPoint:CGPointMake(18.495, 3.121)];
  [path addLineToPoint:CGPointMake(19.042, 2.69)];
  [path addLineToPoint:CGPointMake(20.075, 2.69)];
  [path addLineToPoint:CGPointMake(20.835, 3.819)];
  [path addLineToPoint:CGPointMake(20.495, 4.985)];
  [path addLineToPoint:CGPointMake(19.431, 6.332)];
  [path addLineToPoint:CGPointMake(18.55, 7.474)];
  [path addLineToPoint:CGPointMake(17.286, 9.174)];
  [path addLineToPoint:CGPointMake(16.496, 10.534)];
  [path addLineToPoint:CGPointMake(16.569, 10.644)];
  [path addLineToPoint:CGPointMake(16.757, 10.624)];
  [path addLineToPoint:CGPointMake(19.613, 10.018)];
  [path addLineToPoint:CGPointMake(21.156, 9.738)];
  [path addLineToPoint:CGPointMake(22.997, 9.423)];
  [path addLineToPoint:CGPointMake(23.83, 9.811)];
  [path addLineToPoint:CGPointMake(23.921, 10.206)];
  [path addLineToPoint:CGPointMake(23.593, 11.013)];
  [path addLineToPoint:CGPointMake(21.624, 11.499)];
  [path addLineToPoint:CGPointMake(19.315, 11.961)];
  [path addLineToPoint:CGPointMake(15.876, 12.774)];
  [path addLineToPoint:CGPointMake(15.834, 12.804)];
  [path addLineToPoint:CGPointMake(15.883, 12.865)];
  [path addLineToPoint:CGPointMake(17.432, 13.011)];
  [path addLineToPoint:CGPointMake(18.094, 13.047)];
  [path addLineToPoint:CGPointMake(19.716, 13.047)];
  [path addLineToPoint:CGPointMake(22.736, 13.272)];
  [path addLineToPoint:CGPointMake(23.526, 13.794)];
  [path addLineToPoint:CGPointMake(24, 14.432)];
  [path addLineToPoint:CGPointMake(23.921, 14.917)];
  [path addLineToPoint:CGPointMake(22.706, 15.537)];
  [path addLineToPoint:CGPointMake(21.066, 15.148)];
  [path addLineToPoint:CGPointMake(17.237, 14.238)];
  [path addLineToPoint:CGPointMake(15.925, 13.909)];
  [path addLineToPoint:CGPointMake(15.743, 13.909)];
  [path addLineToPoint:CGPointMake(15.743, 14.019)];
  [path addLineToPoint:CGPointMake(16.836, 15.087)];
  [path addLineToPoint:CGPointMake(18.842, 16.897)];
  [path addLineToPoint:CGPointMake(21.351, 19.227)];
  [path addLineToPoint:CGPointMake(21.478, 19.805)];
  [path addLineToPoint:CGPointMake(21.156, 20.26)];
  [path addLineToPoint:CGPointMake(20.816, 20.211)];
  [path addLineToPoint:CGPointMake(18.611, 18.554)];
  [path addLineToPoint:CGPointMake(17.76, 17.807)];
  [path addLineToPoint:CGPointMake(15.834, 16.187)];
  [path addLineToPoint:CGPointMake(15.706, 16.187)];
  [path addLineToPoint:CGPointMake(15.706, 16.357)];
  [path addLineToPoint:CGPointMake(16.15, 17.006)];
  [path addLineToPoint:CGPointMake(18.495, 20.527)];
  [path addLineToPoint:CGPointMake(18.617, 21.607)];
  [path addLineToPoint:CGPointMake(18.447, 21.96)];
  [path addLineToPoint:CGPointMake(17.839, 22.173)];
  [path addLineToPoint:CGPointMake(17.171, 22.051)];
  [path addLineToPoint:CGPointMake(15.797, 20.126)];
  [path addLineToPoint:CGPointMake(14.382, 17.959)];
  [path addLineToPoint:CGPointMake(13.239, 16.016)];
  [path addLineToPoint:CGPointMake(13.099, 16.096)];
  [path addLineToPoint:CGPointMake(12.425, 23.35)];
  [path addLineToPoint:CGPointMake(12.109, 23.72)];
  [path addLineToPoint:CGPointMake(11.38, 24)];
  [path addLineToPoint:CGPointMake(10.773, 23.539)];
  [path addLineToPoint:CGPointMake(10.451, 22.792)];
  [path addLineToPoint:CGPointMake(10.773, 21.316)];
  [path addLineToPoint:CGPointMake(11.162, 19.392)];
  [path addLineToPoint:CGPointMake(11.477, 17.862)];
  [path addLineToPoint:CGPointMake(11.763, 15.962)];
  [path addLineToPoint:CGPointMake(11.933, 15.33)];
  [path addLineToPoint:CGPointMake(11.921, 15.288)];
  [path addLineToPoint:CGPointMake(11.781, 15.306)];
  [path addLineToPoint:CGPointMake(10.347, 17.273)];
  [path addLineToPoint:CGPointMake(8.167, 20.218)];
  [path addLineToPoint:CGPointMake(6.441, 22.063)];
  [path addLineToPoint:CGPointMake(6.027, 22.227)];
  [path addLineToPoint:CGPointMake(5.31, 21.857)];
  [path addLineToPoint:CGPointMake(5.377, 21.195)];
  [path addLineToPoint:CGPointMake(5.778, 20.606)];
  [path addLineToPoint:CGPointMake(8.166, 17.57)];
  [path addLineToPoint:CGPointMake(9.606, 15.688)];
  [path addLineToPoint:CGPointMake(10.536, 14.602)];
  [path addLineToPoint:CGPointMake(10.53, 14.444)];
  [path addLineToPoint:CGPointMake(10.475, 14.444)];
  [path addLineToPoint:CGPointMake(4.132, 18.56)];
  [path addLineToPoint:CGPointMake(3.002, 18.706)];
  [path addLineToPoint:CGPointMake(2.515, 18.25)];
  [path addLineToPoint:CGPointMake(2.576, 17.504)];
  [path addLineToPoint:CGPointMake(2.807, 17.261)];
  [path addLineToPoint:CGPointMake(4.715, 15.949)];
  [path addLineToPoint:CGPointMake(4.709, 15.955)];
  [path closePath];

  [color setFill];
  [path fill];

  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return [image imageWithRenderingMode:UIImageRenderingModeAlwaysOriginal];
}

@implementation EXPreviewZoomManager (BottomBar)

// Associated object keys for UITextView and height constraint
static char InputTextViewKey;
static char InputHeightConstraintKey;

- (UITextView *)inputTextView {
  return objc_getAssociatedObject(self, &InputTextViewKey);
}

- (void)setInputTextView:(UITextView *)textView {
  objc_setAssociatedObject(self, &InputTextViewKey, textView,
                           OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

- (NSLayoutConstraint *)inputHeightConstraint {
  return objc_getAssociatedObject(self, &InputHeightConstraintKey);
}

- (void)setInputHeightConstraint:(NSLayoutConstraint *)constraint {
  objc_setAssociatedObject(self, &InputHeightConstraintKey, constraint,
                           OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

#pragma mark - Bottom Bar Creation

- (UIView *)createBottomBarView:(UIView *)superview {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window) {
    return nil;
  }

  CGRect screenBounds = window.bounds;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }

  // Create main container view - Native iOS Glass Effect
  // Use UIGlassEffect for native Liquid Glass (iOS 26.0+)
  UIVisualEffect *glassEffect = nil;
  if (@available(iOS 26.0, *)) {
    // Try to use UIGlassEffect if available
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
        // UIGlassEffectStyleRegular = 0
        NSMethodSignature *signature =
            [glassEffectClass methodSignatureForSelector:effectSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:effectSelector];
        [invocation setTarget:glassEffectClass];
        NSInteger style = 0; // UIGlassEffectStyleRegular
        [invocation setArgument:&style atIndex:2];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        glassEffect = (__bridge id)tempResult;

        // Set interactive property
        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig =
              [glassEffect methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation =
              [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:glassEffect];
          BOOL interactive = YES;
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }

        // Keep glass effect transparent (no dark tint)
      }
    }
    // Fallback if UIGlassEffect not available
    if (!glassEffect) {
      if (@available(iOS 13.0, *)) {
        glassEffect =
            [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial];
      } else {
        glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
      }
    }
  } else if (@available(iOS 13.0, *)) {
    // Fallback to SystemMaterial for iOS < 26.0
    glassEffect =
        [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterial];
  } else {
    glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
  }
  UIVisualEffectView *bottomBar =
      [[UIVisualEffectView alloc] initWithEffect:glassEffect];

  // Floating pill shape - all 4 corners rounded (FoundationChat style)
  bottomBar.layer.cornerRadius = 36.0; // Increased from 28 for more rounded look
  bottomBar.layer.cornerCurve = kCACornerCurveContinuous;
  bottomBar.layer.maskedCorners =
      kCALayerMinXMinYCorner | kCALayerMaxXMinYCorner |
      kCALayerMinXMaxYCorner | kCALayerMaxXMaxYCorner; // All corners rounded
  bottomBar.translatesAutoresizingMaskIntoConstraints = NO;
  bottomBar.clipsToBounds = YES;
  bottomBar.userInteractionEnabled = YES;

  // Add directly to superview
  [superview addSubview:bottomBar];

  // Constraints for floating bottom bar (FoundationChat style)
  // 16pt horizontal margins + 12pt gap from bottom (not edge-attached)
  NSLayoutConstraint *bottomConstraint =
      [bottomBar.bottomAnchor constraintEqualToAnchor:superview.bottomAnchor constant:-12];

  NSMutableArray *constraints = [NSMutableArray arrayWithArray:@[
    [bottomBar.leadingAnchor constraintEqualToAnchor:superview.leadingAnchor constant:16],
    [bottomBar.trailingAnchor constraintEqualToAnchor:superview.trailingAnchor constant:-16],
    bottomConstraint
  ]];

  // iPad-specific: max-width and center alignment for better layout
  if ([self isIPad]) {
    CGFloat maxWidth = 700; // Max width on iPad
    [constraints addObject:[bottomBar.widthAnchor constraintLessThanOrEqualToConstant:maxWidth]];
    [constraints addObject:[bottomBar.centerXAnchor constraintEqualToAnchor:superview.centerXAnchor]];
  }

  [NSLayoutConstraint activateConstraints:constraints];
  self.bottomBarBottomConstraint =
      bottomConstraint; // Store for keyboard avoidance

  // We need to add subviews to bottomBar.contentView
  UIView *contentView = bottomBar.contentView;
  // Override hitTest to ensure chevron button receives touches even when
  // extending above We'll handle this in the gesture recognizer instead

  // Floating "Chat" button - native iOS Glass Effect
  UIButton *chevronButton = [UIButton buttonWithType:UIButtonTypeSystem];
  chevronButton.translatesAutoresizingMaskIntoConstraints = NO;

  if (@available(iOS 15.0, *)) {
    // Use glass effect for native look
    SEL glassSelector = NSSelectorFromString(@"glass");
    if ([UIButtonConfiguration respondsToSelector:glassSelector]) {
      NSMethodSignature *signature =
          [UIButtonConfiguration methodSignatureForSelector:glassSelector];
      NSInvocation *invocation =
          [NSInvocation invocationWithMethodSignature:signature];
      [invocation setSelector:glassSelector];
      [invocation setTarget:[UIButtonConfiguration class]];
      [invocation invoke];
      void *tempResult;
      [invocation getReturnValue:&tempResult];
      UIButtonConfiguration *config = (__bridge id)tempResult;

      config.baseForegroundColor = [UIColor whiteColor];
      config.title = @"Chat";
      config.image = [UIImage
           systemImageNamed:@"bubble.left.fill"
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:14
                                      weight:UIImageSymbolWeightMedium]];
      config.imagePlacement = NSDirectionalRectEdgeLeading;
      config.imagePadding = 6;
      config.titleTextAttributesTransformer =
          ^NSDictionary<NSAttributedStringKey, id> *(
              NSDictionary<NSAttributedStringKey, id> *textAttributes) {
        NSMutableDictionary *newAttributes = [textAttributes mutableCopy];
        newAttributes[NSFontAttributeName] =
            [UIFont systemFontOfSize:14 weight:UIFontWeightSemibold];
        return newAttributes;
      };
      chevronButton.configuration = config;
    } else {
      // Fallback
      UIButtonConfiguration *config =
          [UIButtonConfiguration borderlessButtonConfiguration];
      config.baseForegroundColor = [UIColor whiteColor];
      config.title = @"Chat";
      config.image = [UIImage
           systemImageNamed:@"bubble.left.fill"
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:14
                                      weight:UIImageSymbolWeightMedium]];
      config.imagePlacement = NSDirectionalRectEdgeLeading;
      config.imagePadding = 6;
      chevronButton.configuration = config;
    }
  } else {
    // Fallback for iOS < 15.0
    UIImageSymbolConfiguration *chatConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:14
                            weight:UIImageSymbolWeightMedium];
    UIImage *chatImage = [UIImage systemImageNamed:@"bubble.left.fill"
                                    withConfiguration:chatConfig];
    [chevronButton setImage:chatImage forState:UIControlStateNormal];
    [chevronButton setTitle:@"Chat" forState:UIControlStateNormal];
    chevronButton.titleLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightSemibold];
    chevronButton.titleLabel.numberOfLines = 1;
    chevronButton.titleLabel.adjustsFontSizeToFitWidth = YES;
    chevronButton.tintColor = [UIColor whiteColor];
    // Adjust spacing between image and title
    chevronButton.imageEdgeInsets = UIEdgeInsetsMake(0, -4, 0, 4);
    chevronButton.titleEdgeInsets = UIEdgeInsetsMake(0, 4, 0, -4);
  }

  // Add dark background for visibility
  chevronButton.backgroundColor = [UIColor colorWithWhite:0.15 alpha:0.9];
  chevronButton.layer.cornerRadius = 18;
  chevronButton.clipsToBounds = YES;

  [chevronButton addTarget:self
                    action:@selector(handleChevronButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];

  // Add to SUPERVIEW (not bottom bar) to avoid clipping and ensure visibility
  [superview addSubview:chevronButton];
  // Ensure it's above everything
  chevronButton.layer.zPosition = 1000;

  chevronButton.clipsToBounds = NO;
  self.bottomBarChevronButton = chevronButton;

  // Input field container - native iOS Glass Effect
  // Use UIGlassEffect for native Liquid Glass (iOS 26.0+)
  UIVisualEffect *inputGlassEffect = nil;
  if (@available(iOS 26.0, *)) {
    // Try to use UIGlassEffect if available
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
        // UIGlassEffectStyleRegular = 0
        NSMethodSignature *signature =
            [glassEffectClass methodSignatureForSelector:effectSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:effectSelector];
        [invocation setTarget:glassEffectClass];
        NSInteger style = 0; // UIGlassEffectStyleRegular
        [invocation setArgument:&style atIndex:2];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        inputGlassEffect = (__bridge id)tempResult;

        // Set interactive property
        if (inputGlassEffect &&
            [inputGlassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig = [inputGlassEffect
              methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation =
              [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:inputGlassEffect];
          BOOL interactive = YES;
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }

        // Keep glass effect transparent (no dark tint) for input container
      }
    }
    // Fallback if UIGlassEffect not available
    if (!inputGlassEffect) {
      if (@available(iOS 13.0, *)) {
        inputGlassEffect = [UIBlurEffect
            effectWithStyle:UIBlurEffectStyleSystemUltraThinMaterial];
      } else {
        inputGlassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
      }
    }
  } else if (@available(iOS 13.0, *)) {
    // Fallback to SystemUltraThinMaterial for iOS < 26.0
    inputGlassEffect =
        [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemUltraThinMaterial];
  } else {
    inputGlassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
  }
  UIVisualEffectView *inputContainer =
      [[UIVisualEffectView alloc] initWithEffect:inputGlassEffect];
  inputContainer.layer.cornerRadius = 24.0;
  inputContainer.layer.cornerCurve = kCACornerCurveContinuous;
  inputContainer.translatesAutoresizingMaskIntoConstraints = NO;
  inputContainer.userInteractionEnabled = YES;
  [contentView addSubview:inputContainer];

  // Get the content view for adding subviews
  UIView *inputContentView = inputContainer.contentView;

  // Claude Model Selector Button - only visible when billingMode is 'credits' (Claude agent)
  UIButton *modelSelectorButton = [UIButton buttonWithType:UIButtonTypeSystem];
  modelSelectorButton.translatesAutoresizingMaskIntoConstraints = NO;

  // Create Claude icon with coral/orange color from official branding
  UIColor *claudeColor = [UIColor colorWithRed:0.85 green:0.467 blue:0.341 alpha:1.0]; // #D97757
  UIImage *claudeIcon = createClaudeIconImage(20, claudeColor);

  if (@available(iOS 26.0, *)) {
    SEL glassSelector = NSSelectorFromString(@"glass");
    if ([UIButtonConfiguration respondsToSelector:glassSelector]) {
      NSMethodSignature *signature =
          [UIButtonConfiguration methodSignatureForSelector:glassSelector];
      NSInvocation *invocation =
          [NSInvocation invocationWithMethodSignature:signature];
      [invocation setSelector:glassSelector];
      [invocation setTarget:[UIButtonConfiguration class]];
      [invocation invoke];
      void *tempResult;
      [invocation getReturnValue:&tempResult];
      UIButtonConfiguration *config = (__bridge id)tempResult;

      config.image = claudeIcon;
      config.baseForegroundColor = claudeColor;
      modelSelectorButton.configuration = config;
    } else {
      UIButtonConfiguration *config =
          [UIButtonConfiguration plainButtonConfiguration];
      config.image = claudeIcon;
      config.baseForegroundColor = claudeColor;
      modelSelectorButton.configuration = config;
    }
  } else if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image = claudeIcon;
    config.baseForegroundColor = claudeColor;
    modelSelectorButton.configuration = config;
  } else {
    [modelSelectorButton setImage:claudeIcon forState:UIControlStateNormal];
    modelSelectorButton.tintColor = claudeColor;
  }

  // Configure UIMenu for model selection (iOS 14+)
  if (@available(iOS 14.0, *)) {
    NSString *selectedModel = [[NSUserDefaults standardUserDefaults]
        stringForKey:@"SelectedClaudeModel"] ?: @"claude-opus-4-5-20251101";

    __weak typeof(self) weakSelf = self;

    // Create Claude icon for menu items
    UIImage *menuClaudeIcon = createClaudeIconImage(18, claudeColor);

    UIAction *opusAction = [UIAction
        actionWithTitle:@"Claude Opus 4.5"
                  image:menuClaudeIcon
             identifier:@"claude-opus-4-5-20251101"
                handler:^(__kindof UIAction *_Nonnull action) {
                  [[NSUserDefaults standardUserDefaults]
                      setObject:@"claude-opus-4-5-20251101"
                         forKey:@"SelectedClaudeModel"];
                  [[NSUserDefaults standardUserDefaults] synchronize];
                  [weakSelf updateModelSelectorMenu];
                }];
    if ([selectedModel isEqualToString:@"claude-opus-4-5-20251101"]) {
      opusAction.state = UIMenuElementStateOn;
    }

    UIAction *sonnetAction = [UIAction
        actionWithTitle:@"Claude Sonnet 4.5"
                  image:menuClaudeIcon
             identifier:@"claude-sonnet-4-5"
                handler:^(__kindof UIAction *_Nonnull action) {
                  [[NSUserDefaults standardUserDefaults]
                      setObject:@"claude-sonnet-4-5"
                         forKey:@"SelectedClaudeModel"];
                  [[NSUserDefaults standardUserDefaults] synchronize];
                  [weakSelf updateModelSelectorMenu];
                }];
    if ([selectedModel isEqualToString:@"claude-sonnet-4-5"]) {
      sonnetAction.state = UIMenuElementStateOn;
    }

    UIAction *haikuAction = [UIAction
        actionWithTitle:@"Claude Haiku 4.5"
                  image:menuClaudeIcon
             identifier:@"claude-haiku-4-5"
                handler:^(__kindof UIAction *_Nonnull action) {
                  [[NSUserDefaults standardUserDefaults]
                      setObject:@"claude-haiku-4-5"
                         forKey:@"SelectedClaudeModel"];
                  [[NSUserDefaults standardUserDefaults] synchronize];
                  [weakSelf updateModelSelectorMenu];
                }];
    if ([selectedModel isEqualToString:@"claude-haiku-4-5"]) {
      haikuAction.state = UIMenuElementStateOn;
    }

    UIMenu *modelMenu = [UIMenu
        menuWithTitle:@"Select Model"
             children:@[opusAction, sonnetAction, haikuAction]];

    modelSelectorButton.menu = modelMenu;
    modelSelectorButton.showsMenuAsPrimaryAction = YES;
  }

  modelSelectorButton.hidden = NO; // Always visible (will be updated based on billingMode later)
  [inputContentView addSubview:modelSelectorButton];
  self.modelSelectorButton = modelSelectorButton;

  // Image icon (next to model selector) - native glass effect
  UIButton *imageButton = [UIButton buttonWithType:UIButtonTypeSystem];
  imageButton.translatesAutoresizingMaskIntoConstraints = NO;

  if (@available(iOS 26.0, *)) {
    // Use runtime check to safely call iOS 26.0 glass() method
    SEL glassSelector = NSSelectorFromString(@"glass");
    if ([UIButtonConfiguration respondsToSelector:glassSelector]) {
      NSMethodSignature *signature =
          [UIButtonConfiguration methodSignatureForSelector:glassSelector];
      NSInvocation *invocation =
          [NSInvocation invocationWithMethodSignature:signature];
      [invocation setSelector:glassSelector];
      [invocation setTarget:[UIButtonConfiguration class]];
      [invocation invoke];
      void *tempResult;
      [invocation getReturnValue:&tempResult];
      UIButtonConfiguration *config = (__bridge id)tempResult;

      config.image = [UIImage
           systemImageNamed:@"photo.on.rectangle.angled"
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:16
                                      weight:UIImageSymbolWeightMedium]];
      config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
      imageButton.configuration = config;
    } else {
      // Fallback if method not available
      UIButtonConfiguration *config =
          [UIButtonConfiguration plainButtonConfiguration];
      config.image = [UIImage
           systemImageNamed:@"photo.on.rectangle.angled"
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:16
                                      weight:UIImageSymbolWeightMedium]];
      config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
      imageButton.configuration = config;
    }
  } else if (@available(iOS 15.0, *)) {
    // Fallback for iOS < 26.0
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image = [UIImage
         systemImageNamed:@"photo.on.rectangle.angled"
        withConfiguration:
            [UIImageSymbolConfiguration
                configurationWithPointSize:16
                                    weight:UIImageSymbolWeightMedium]];
    config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
    imageButton.configuration = config;
  } else {
    UIImageSymbolConfiguration *imageConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:16
                            weight:UIImageSymbolWeightMedium];
    UIImage *imageIconImage = [UIImage systemImageNamed:@"photo.on.rectangle.angled"
                                      withConfiguration:imageConfig];
    [imageButton setImage:imageIconImage forState:UIControlStateNormal];
    imageButton.tintColor = [UIColor colorWithWhite:0.8 alpha:1.0];
  }
  imageButton.alpha = 1.0;
  imageButton.enabled = YES;
  [imageButton addTarget:self
                  action:@selector(handleImageButtonTapped:)
        forControlEvents:UIControlEventTouchUpInside];
  imageButton.translatesAutoresizingMaskIntoConstraints = NO;
  imageButton.hidden = NO; // Always visible
  [inputContentView addSubview:imageButton];
  self.imageButton = imageButton;

  // Input field - using UITextView for dynamic height growth
  UITextView *inputTextView = [[UITextView alloc] init];
  inputTextView.font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
  inputTextView.backgroundColor = [UIColor clearColor];
  inputTextView.translatesAutoresizingMaskIntoConstraints = NO;
  inputTextView.returnKeyType = UIReturnKeySend;
  inputTextView.autocorrectionType = UITextAutocorrectionTypeNo;
  inputTextView.autocapitalizationType = UITextAutocapitalizationTypeNone;
  inputTextView.textContainerInset = UIEdgeInsetsMake(10, 0, 10, 0);
  inputTextView.textContainer.lineFragmentPadding = 0;
  inputTextView.scrollEnabled = NO; // Disable scrolling to allow height growth
  inputTextView.textContainer.maximumNumberOfLines = 0; // Allow unlimited lines
  inputTextView.textContainer.widthTracksTextView = YES;
  inputTextView.textContainer.heightTracksTextView = NO;

  // Set placeholder text
  inputTextView.text = @"Message";
  inputTextView.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];

  [inputContentView addSubview:inputTextView];
  // Store UITextView reference
  self.inputTextView = inputTextView;
  inputTextView.delegate = self; // Set delegate

  // Create height constraint for dynamic growth (min 40, max ~120)
  NSLayoutConstraint *inputHeightConstraint =
      [inputTextView.heightAnchor constraintEqualToConstant:40];
  inputHeightConstraint.priority = UILayoutPriorityDefaultHigh;
  inputHeightConstraint.active = YES;
  self.inputHeightConstraint = inputHeightConstraint;

  // Add text change observer for dynamic height and max length
  [[NSNotificationCenter defaultCenter]
      addObserver:self
         selector:@selector(handleTextViewDidChange:)
             name:UITextViewTextDidChangeNotification
           object:inputTextView];

  // Mic button (right side, always visible) - native glass effect
  UIButton *micButton = [UIButton buttonWithType:UIButtonTypeSystem];
  micButton.translatesAutoresizingMaskIntoConstraints = NO;

  if (@available(iOS 26.0, *)) {
    // Use runtime check to safely call iOS 26.0 glass() method
    SEL glassSelector = NSSelectorFromString(@"glass");
    if ([UIButtonConfiguration respondsToSelector:glassSelector]) {
      NSMethodSignature *signature =
          [UIButtonConfiguration methodSignatureForSelector:glassSelector];
      NSInvocation *invocation =
          [NSInvocation invocationWithMethodSignature:signature];
      [invocation setSelector:glassSelector];
      [invocation setTarget:[UIButtonConfiguration class]];
      [invocation invoke];
      void *tempResult;
      [invocation getReturnValue:&tempResult];
      UIButtonConfiguration *config = (__bridge id)tempResult;

      config.image = [UIImage
           systemImageNamed:@"mic.fill"
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:16
                                      weight:UIImageSymbolWeightMedium]];
      config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
      micButton.configuration = config;
    } else {
      // Fallback if method not available
      UIButtonConfiguration *config =
          [UIButtonConfiguration plainButtonConfiguration];
      config.image = [UIImage
           systemImageNamed:@"mic.fill"
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:16
                                      weight:UIImageSymbolWeightMedium]];
      config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
      micButton.configuration = config;
    }
  } else if (@available(iOS 15.0, *)) {
    // Fallback for iOS < 26.0
    UIButtonConfiguration *config =
        [UIButtonConfiguration plainButtonConfiguration];
    config.image = [UIImage
         systemImageNamed:@"mic.fill"
        withConfiguration:
            [UIImageSymbolConfiguration
                configurationWithPointSize:16
                                    weight:UIImageSymbolWeightMedium]];
    config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
    micButton.configuration = config;
  } else {
    UIImageSymbolConfiguration *micConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:16
                            weight:UIImageSymbolWeightMedium];
    UIImage *micImage = [UIImage systemImageNamed:@"mic.fill"
                                withConfiguration:micConfig];
    [micButton setImage:micImage forState:UIControlStateNormal];
    micButton.tintColor = [UIColor colorWithWhite:0.8 alpha:1.0];
  }

  [inputContentView addSubview:micButton];
  [micButton addTarget:self
                action:@selector(handleMicButtonTapped:)
      forControlEvents:UIControlEventTouchUpInside];
  self.micButton = micButton;

  // Send button (appears to the RIGHT of mic when text is entered) - native
  // glass effect
  UIButton *sendButton = [UIButton buttonWithType:UIButtonTypeSystem];
  sendButton.translatesAutoresizingMaskIntoConstraints = NO;

  if (@available(iOS 26.0, *)) {
    // Use runtime check to safely call iOS 26.0 prominentGlass() method
    SEL prominentGlassSelector = NSSelectorFromString(@"prominentGlass");
    if ([UIButtonConfiguration respondsToSelector:prominentGlassSelector]) {
      NSMethodSignature *signature = [UIButtonConfiguration
          methodSignatureForSelector:prominentGlassSelector];
      NSInvocation *invocation =
          [NSInvocation invocationWithMethodSignature:signature];
      [invocation setSelector:prominentGlassSelector];
      [invocation setTarget:[UIButtonConfiguration class]];
      [invocation invoke];
      void *tempResult;
      [invocation getReturnValue:&tempResult];
      UIButtonConfiguration *config = (__bridge id)tempResult;

      config.image =
          [UIImage systemImageNamed:@"paperplane.fill"
                  withConfiguration:
                      [UIImageSymbolConfiguration
                          configurationWithPointSize:16
                                              weight:UIImageSymbolWeightBold]];
      config.baseForegroundColor = [UIColor whiteColor];
      config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
      sendButton.configuration = config;
    } else {
      // Fallback if method not available
      UIButtonConfiguration *config =
          [UIButtonConfiguration filledButtonConfiguration];
      config.image =
          [UIImage systemImageNamed:@"paperplane.fill"
                  withConfiguration:
                      [UIImageSymbolConfiguration
                          configurationWithPointSize:16
                                              weight:UIImageSymbolWeightBold]];
      config.baseBackgroundColor = [UIColor systemBlueColor];
      config.baseForegroundColor = [UIColor whiteColor];
      config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
      sendButton.configuration = config;
    }
  } else if (@available(iOS 15.0, *)) {
    // Fallback for iOS < 26.0
    UIButtonConfiguration *config =
        [UIButtonConfiguration filledButtonConfiguration];
    config.image =
        [UIImage systemImageNamed:@"paperplane.fill"
                withConfiguration:
                    [UIImageSymbolConfiguration
                        configurationWithPointSize:16
                                            weight:UIImageSymbolWeightBold]];
    config.baseBackgroundColor = [UIColor systemBlueColor];
    config.baseForegroundColor = [UIColor whiteColor];
    config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
    sendButton.configuration = config;
  } else {
    UIImageSymbolConfiguration *sendConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:20
                            weight:UIImageSymbolWeightBold];
    UIImage *sendImage = [UIImage systemImageNamed:@"paperplane.fill"
                                 withConfiguration:sendConfig];
    [sendButton setImage:sendImage forState:UIControlStateNormal];
    sendButton.tintColor = [UIColor whiteColor];
    sendButton.backgroundColor = [UIColor systemBlueColor];
    sendButton.layer.cornerRadius = 20;
  }

  sendButton.hidden = YES; // Hidden by default, shown when text exists
  sendButton.userInteractionEnabled = YES;
  sendButton.enabled = YES;
  [sendButton addTarget:self
                 action:@selector(handleSendButtonTapped:)
       forControlEvents:UIControlEventTouchUpInside];
  [inputContentView addSubview:sendButton];
  [inputContentView bringSubviewToFront:sendButton]; // Ensure send button is on top
  self.sendButton = sendButton;

  // Action buttons container - use UIScrollView for horizontal scrolling when buttons exceed width
  UIScrollView *actionsScrollView = [[UIScrollView alloc] init];
  actionsScrollView.translatesAutoresizingMaskIntoConstraints = NO;
  actionsScrollView.showsHorizontalScrollIndicator = YES;  // Show native scroll indicator
  actionsScrollView.showsVerticalScrollIndicator = NO;
  actionsScrollView.bounces = YES;
  actionsScrollView.alwaysBounceHorizontal = YES;
  actionsScrollView.indicatorStyle = UIScrollViewIndicatorStyleWhite;  // White indicator for dark background
  actionsScrollView.tag = 9999;  // Tag to identify this scroll view
  [contentView addSubview:actionsScrollView];
  self.actionsScrollView = actionsScrollView;  // Store reference

  UIView *actionsContainer = [[UIView alloc] init];
  actionsContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [actionsScrollView addSubview:actionsContainer];

  // Create action buttons - ordered for non-technical users (creative/fun first)
  // NOTE: Video temporarily hidden
  NSArray *buttonConfigs = @[
    @{@"icon" : @"photo.badge.plus.fill", @"label" : @"Image"}, // 0 - Visual/creative - most engaging
    // @{@"icon" : @"video.badge.waveform.fill", @"label" : @"Video"}, // TEMPORARILY HIDDEN
    @{@"icon" : @"waveform.and.mic", @"label" : @"Audio"},      // 1 - Audio/music
    @{@"icon" : @"doc.text.magnifyingglass", @"label" : @"Logs"}, // 2 - See what's happening (helpful when things break)
    @{@"icon" : @"waveform.circle.fill", @"label" : @"Haptic"}, // 3 - Fun vibration feedback
    @{@"icon" : @"dollarsign.circle.fill", @"label" : @"Payment"}, // 4 - Monetization
    @{@"icon" : @"apple.logo", @"label" : @"Publish"},          // 5 - Get on App Store!
    @{@"icon" : @"cylinder.split.1x2.fill", @"label" : @"DB"},  // 6 - Data storage
    @{@"icon" : @"server.rack", @"label" : @"API"},             // 7 - Backend (technical)
    @{@"icon" : @"folder.fill", @"label" : @"Files"},           // 8 - Project files (technical)
    @{@"icon" : @"key.fill", @"label" : @"ENV"}                 // 9 - Environment vars (most technical)
  ];

  NSMutableArray *actionButtons = [NSMutableArray array];
  for (NSInteger i = 0; i < buttonConfigs.count; i++) {
    NSDictionary *config = buttonConfigs[i];
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    button.translatesAutoresizingMaskIntoConstraints = NO;
    button.tag = i;

    if (@available(iOS 26.0, *)) {
      // Use runtime check to safely call iOS 26.0 glass() method
      SEL glassSelector = NSSelectorFromString(@"glass");
      if ([UIButtonConfiguration respondsToSelector:glassSelector]) {
        NSMethodSignature *signature =
            [UIButtonConfiguration methodSignatureForSelector:glassSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:glassSelector];
        [invocation setTarget:[UIButtonConfiguration class]];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        UIButtonConfiguration *buttonConfig = (__bridge id)tempResult;

        buttonConfig.image = [UIImage
             systemImageNamed:config[@"icon"]
            withConfiguration:
                [UIImageSymbolConfiguration
                    configurationWithPointSize:16
                                        weight:UIImageSymbolWeightRegular]];
        buttonConfig.title = config[@"label"];
        buttonConfig.imagePlacement = NSDirectionalRectEdgeTop;
        buttonConfig.imagePadding = 2;
        buttonConfig.baseForegroundColor = [UIColor whiteColor];
        buttonConfig.titleLineBreakMode = NSLineBreakByTruncatingTail;
        buttonConfig.titleTextAttributesTransformer =
            ^NSDictionary<NSAttributedStringKey, id> *(
                NSDictionary<NSAttributedStringKey, id> *textAttributes) {
          NSMutableDictionary *newAttributes = [textAttributes mutableCopy];
          newAttributes[NSFontAttributeName] =
              [UIFont systemFontOfSize:9 weight:UIFontWeightRegular];
          return newAttributes;
        };

        button.configuration = buttonConfig;
      } else {
        // Fallback if method not available
        UIButtonConfiguration *buttonConfig =
            [UIButtonConfiguration plainButtonConfiguration];
        buttonConfig.image = [UIImage
             systemImageNamed:config[@"icon"]
            withConfiguration:
                [UIImageSymbolConfiguration
                    configurationWithPointSize:16
                                        weight:UIImageSymbolWeightRegular]];
        buttonConfig.title = config[@"label"];
        buttonConfig.imagePlacement = NSDirectionalRectEdgeTop;
        buttonConfig.imagePadding = 2;
        buttonConfig.baseForegroundColor = [UIColor whiteColor];
        buttonConfig.titleLineBreakMode = NSLineBreakByTruncatingTail;
        buttonConfig.titleTextAttributesTransformer =
            ^NSDictionary<NSAttributedStringKey, id> *(
                NSDictionary<NSAttributedStringKey, id> *textAttributes) {
          NSMutableDictionary *newAttributes = [textAttributes mutableCopy];
          newAttributes[NSFontAttributeName] =
              [UIFont systemFontOfSize:9 weight:UIFontWeightRegular];
          return newAttributes;
        };

        button.configuration = buttonConfig;
      }
    } else if (@available(iOS 15.0, *)) {
      // Fallback for iOS < 26.0
      UIButtonConfiguration *buttonConfig =
          [UIButtonConfiguration plainButtonConfiguration];
      buttonConfig.image = [UIImage
           systemImageNamed:config[@"icon"]
          withConfiguration:
              [UIImageSymbolConfiguration
                  configurationWithPointSize:16
                                      weight:UIImageSymbolWeightRegular]];
      buttonConfig.title = config[@"label"];
      buttonConfig.imagePlacement = NSDirectionalRectEdgeTop;
      buttonConfig.imagePadding = 2;
      buttonConfig.baseForegroundColor = [UIColor whiteColor];
      buttonConfig.titleLineBreakMode = NSLineBreakByTruncatingTail;
      buttonConfig.titleTextAttributesTransformer =
          ^NSDictionary<NSAttributedStringKey, id> *(
              NSDictionary<NSAttributedStringKey, id> *textAttributes) {
        NSMutableDictionary *newAttributes = [textAttributes mutableCopy];
        newAttributes[NSFontAttributeName] =
            [UIFont systemFontOfSize:9 weight:UIFontWeightRegular];
        return newAttributes;
      };

      button.configuration = buttonConfig;
    } else {
      // Fallback
      UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
          configurationWithPointSize:16
                              weight:UIImageSymbolWeightRegular];
      UIImage *iconImage = [UIImage systemImageNamed:config[@"icon"]
                                   withConfiguration:iconConfig];
      [button setImage:iconImage forState:UIControlStateNormal];
      [button setTitle:config[@"label"] forState:UIControlStateNormal];
      button.tintColor = [UIColor whiteColor];
      button.titleLabel.font = [UIFont systemFontOfSize:9];
      button.titleLabel.numberOfLines = 1;
      button.titleLabel.adjustsFontSizeToFitWidth = YES;
      button.titleLabel.minimumScaleFactor = 0.7;
      // Center image and title vertically
      CGSize imageSize = button.imageView.frame.size;
      button.titleEdgeInsets =
          UIEdgeInsetsMake(0, -imageSize.width, -imageSize.height - 4, 0);
      CGSize titleSize = button.titleLabel.frame.size;
      button.imageEdgeInsets =
          UIEdgeInsetsMake(-titleSize.height - 4, 0, 0, -titleSize.width);
    }

    // Wire up Image Studio button (index 0) to show modal
    if (i == 0 && [config[@"label"] isEqualToString:@"Image"]) {
      [button addTarget:self
                    action:@selector(handleImageStudioButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Video Studio button temporarily removed from config array

    // Wire up Audio Studio button (index 1) to show modal
    if (i == 1 && [config[@"label"] isEqualToString:@"Audio"]) {
      [button addTarget:self
                    action:@selector(handleAudioStudioButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up Logs button (index 2) to show modal
    if (i == 2 && [config[@"label"] isEqualToString:@"Logs"]) {
      [button addTarget:self
                    action:@selector(handleLogsButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up Haptic button (index 3) to show modal
    if (i == 3 && [config[@"label"] isEqualToString:@"Haptic"]) {
      [button addTarget:self
                    action:@selector(handleHapticButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up Payments button (index 4) to show modal
    if (i == 4 && [config[@"label"] isEqualToString:@"Payment"]) {
      [button addTarget:self
                    action:@selector(handlePaymentsButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up Publish button (index 5) to show App Store modal
    if (i == 5 && [config[@"label"] isEqualToString:@"Publish"]) {
      [button addTarget:self
                    action:@selector(handlePublishButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up Database button (index 6) to show modal
    if (i == 6 && [config[@"label"] isEqualToString:@"DB"]) {
      [button addTarget:self
                    action:@selector(handleDatabaseButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up API button (index 7) to show modal
    if (i == 7 && [config[@"label"] isEqualToString:@"API"]) {
      [button addTarget:self
                    action:@selector(handleAPIButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up Files button (index 8) to show modal
    if (i == 8 && [config[@"label"] isEqualToString:@"Files"]) {
      [button addTarget:self
                    action:@selector(handleFilesButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    // Wire up ENV button (index 9) to show modal
    if (i == 9 && [config[@"label"] isEqualToString:@"ENV"]) {
      [button addTarget:self
                    action:@selector(handleENVButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
    }

    [actionsContainer addSubview:button];
    [actionButtons addObject:button]; // Store button instead of container
  }

  // Layout constraints for bottom bar
  // Create and store height constraint separately for dynamic updates
  NSLayoutConstraint *inputContainerHeight =
      [inputContainer.heightAnchor constraintEqualToConstant:52];
  self.inputContainerHeightConstraint = inputContainerHeight;

  [NSLayoutConstraint activateConstraints:@[
    // Input container - professional height, positioned at top with spacing for
    // chevron
    [inputContainer.topAnchor constraintEqualToAnchor:contentView.topAnchor
                                             constant:12], // Space for chevron
    [inputContainer.leadingAnchor
        constraintEqualToAnchor:contentView.leadingAnchor
                       constant:16],
    [inputContainer.trailingAnchor
        constraintEqualToAnchor:contentView.trailingAnchor
                       constant:-16],
    inputContainerHeight,

    // Settings button removed - model selector is now the leftmost button

    // Model selector button (leftmost button) - use topAnchor for stable positioning
    [modelSelectorButton.leadingAnchor
        constraintEqualToAnchor:inputContentView.leadingAnchor
                       constant:8],
    [modelSelectorButton.topAnchor
        constraintEqualToAnchor:inputContentView.topAnchor
                       constant:10],
    [modelSelectorButton.widthAnchor constraintEqualToConstant:32],
    [modelSelectorButton.heightAnchor constraintEqualToConstant:32],

    // Image button - only vertical and size constraints here
    // Leading constraint will be set dynamically based on model selector visibility
    [imageButton.topAnchor
        constraintEqualToAnchor:inputContentView.topAnchor
                       constant:10],
    [imageButton.widthAnchor constraintEqualToConstant:32],
    [imageButton.heightAnchor constraintEqualToConstant:32],

    // Input field - pin to top and bottom for proper growth without shifting
    [inputTextView.topAnchor
        constraintEqualToAnchor:inputContentView.topAnchor
                       constant:6],
    [inputTextView.bottomAnchor
        constraintEqualToAnchor:inputContentView.bottomAnchor
                       constant:-6],
    [inputTextView.trailingAnchor
        constraintEqualToAnchor:micButton.leadingAnchor
                       constant:-12],
    [inputTextView.leadingAnchor
        constraintEqualToAnchor:imageButton.trailingAnchor
                       constant:12], // Will be updated dynamically

    // Send button (appears to the RIGHT of mic when text is entered) -
    // use topAnchor for stable positioning
    [sendButton.trailingAnchor
        constraintEqualToAnchor:inputContentView.trailingAnchor
                       constant:-4],
    [sendButton.topAnchor
        constraintEqualToAnchor:inputContentView.topAnchor
                       constant:4],
    [sendButton.widthAnchor constraintEqualToConstant:44],  // Increased from 36 to 44 for better hit target
    [sendButton.heightAnchor constraintEqualToConstant:44], // Increased from 36 to 44 for better hit target

    // Mic button (right side, always visible) - use topAnchor for stable positioning
    [micButton.topAnchor
        constraintEqualToAnchor:inputContentView.topAnchor
                       constant:10],
    [micButton.widthAnchor constraintEqualToConstant:32],
    [micButton.heightAnchor constraintEqualToConstant:32],

    // Chat button - floating ABOVE the bottom bar
    [chevronButton.centerXAnchor
        constraintEqualToAnchor:bottomBar.centerXAnchor],
    [chevronButton.bottomAnchor
        constraintEqualToAnchor:bottomBar.topAnchor
                       constant:-10],
    [chevronButton.widthAnchor constraintEqualToConstant:100],  // Wider to fit "Chat" text without wrapping
    [chevronButton.heightAnchor constraintEqualToConstant:36]
  ]];

  // Input field leading constraints - create and store for dynamic toggling
  // Default: input leading to container (when buttons hidden - keyboard closed)
  NSLayoutConstraint *inputFieldLeadingToImage = [inputTextView.leadingAnchor
      constraintEqualToAnchor:imageButton.trailingAnchor
                     constant:12];
  NSLayoutConstraint *inputFieldLeadingToContainer =
      [inputTextView.leadingAnchor
          constraintEqualToAnchor:inputContentView.leadingAnchor
                         constant:12];
  // Image button is always visible, so input field should always anchor to it
  // This fixes the placeholder positioning issue on initial load
  inputFieldLeadingToImage.active = YES;
  inputFieldLeadingToContainer.active = NO;
  // Store constraints for later toggling
  self.inputFieldLeadingToImageConstraint = inputFieldLeadingToImage;
  self.inputFieldLeadingToContainerConstraint = inputFieldLeadingToContainer;

  // Image button leading constraints - create and store for dynamic toggling
  // When model selector is visible, image button is next to it
  // When model selector is hidden, image button goes to leading edge
  NSLayoutConstraint *imageLeadingToModel = [imageButton.leadingAnchor
      constraintEqualToAnchor:modelSelectorButton.trailingAnchor
                     constant:4];
  NSLayoutConstraint *imageLeadingToContainer = [imageButton.leadingAnchor
      constraintEqualToAnchor:inputContentView.leadingAnchor
                     constant:8];
  // Default: model selector is visible, so image is next to it
  imageLeadingToModel.active = YES;
  imageLeadingToContainer.active = NO;
  // Store constraints for later toggling
  self.imageButtonLeadingToModelConstraint = imageLeadingToModel;
  self.imageButtonLeadingToContainerConstraint = imageLeadingToContainer;

  // Mic button constraints - create and store for dynamic toggling
  // Default: mic trailing to inputContainer (when send is hidden)
  NSLayoutConstraint *micTrailingToContainer = [micButton.trailingAnchor
      constraintEqualToAnchor:inputContentView.trailingAnchor
                     constant:-8];
  NSLayoutConstraint *micTrailingToSend =
      [micButton.trailingAnchor constraintEqualToAnchor:sendButton.leadingAnchor
                                               constant:-4];
  micTrailingToSend.active =
      NO; // Initially inactive (send is hidden by default)
  micTrailingToContainer.active = YES; // Initially active
  // Store constraints for later toggling
  self.micToContainerConstraint = micTrailingToContainer;
  self.micToSendConstraint = micTrailingToSend;

  // Actions scroll view constraints
  [NSLayoutConstraint activateConstraints:@[
    [actionsScrollView.topAnchor
        constraintEqualToAnchor:inputContainer.bottomAnchor
                       constant:12],
    [actionsScrollView.leadingAnchor
        constraintEqualToAnchor:contentView.leadingAnchor],
    [actionsScrollView.trailingAnchor
        constraintEqualToAnchor:contentView.trailingAnchor],
    [actionsScrollView.bottomAnchor
        constraintEqualToAnchor:contentView.bottomAnchor
                       constant:-(safeAreaBottom + 8)],
    [actionsScrollView.heightAnchor constraintEqualToConstant:70]
  ]];

  // Actions container constraints (inside scroll view)
  [NSLayoutConstraint activateConstraints:@[
    [actionsContainer.topAnchor constraintEqualToAnchor:actionsScrollView.topAnchor],
    [actionsContainer.leadingAnchor constraintEqualToAnchor:actionsScrollView.leadingAnchor],
    [actionsContainer.trailingAnchor constraintEqualToAnchor:actionsScrollView.trailingAnchor],
    [actionsContainer.bottomAnchor constraintEqualToAnchor:actionsScrollView.bottomAnchor],
    [actionsContainer.heightAnchor constraintEqualToAnchor:actionsScrollView.heightAnchor]
  ]];

  // Layout action buttons horizontally with fixed width for scrolling
  CGFloat buttonWidth = 65.0; // Fixed width for each button
  UIView *previousButton = nil;
  for (UIButton *button in actionButtons) {
    [NSLayoutConstraint activateConstraints:@[
      [button.topAnchor constraintEqualToAnchor:actionsContainer.topAnchor],
      [button.bottomAnchor constraintEqualToAnchor:actionsContainer.bottomAnchor],
      [button.widthAnchor constraintEqualToConstant:buttonWidth]
    ]];

    if (previousButton) {
      [NSLayoutConstraint activateConstraints:@[
        [button.leadingAnchor
            constraintEqualToAnchor:previousButton.trailingAnchor]
      ]];
    } else {
      [NSLayoutConstraint activateConstraints:@[
        [button.leadingAnchor
            constraintEqualToAnchor:actionsContainer.leadingAnchor]
      ]];
    }

    previousButton = button;
  }

  // Set trailing constraint on last button to define content width
  if (previousButton) {
    [NSLayoutConstraint activateConstraints:@[
      [previousButton.trailingAnchor constraintEqualToAnchor:actionsContainer.trailingAnchor]
    ]];
  }

  // Force initial layout to ensure placeholder text is properly positioned
  [bottomBar layoutIfNeeded];

  // Return the bottom bar as the main view reference
  return bottomBar;
}

- (void)handleBottomBarTap:(UITapGestureRecognizer *)gestureRecognizer {
  // This handler prevents the tap from propagating to the preview container
  // Don't interfere with button taps - let the button handle its own touches
  // Just prevent the tap from propagating to the preview container
}

- (void)handleInputFieldDidChange:(UITextField *)textField {
  // Legacy method for UITextField - now handled by handleTextViewDidChange
}

- (void)handleTextViewDidChange:(NSNotification *)notification {
  UITextView *textView = (UITextView *)notification.object;
  if (!textView || textView != self.inputTextView) {
    return;
  }

  // Skip processing during reset to prevent constraint conflicts
  if (self.isResettingInput) {
    return;
  }

  // Get current text
  NSString *currentText = @"";
  if (textView.attributedText) {
    currentText = textView.attributedText.string ?: @"";
  } else {
    currentText = textView.text ?: @"";
  }

  // Store previous length to detect deletions
  static NSInteger previousLength = 0;
  NSInteger currentLength = currentText.length;
  BOOL textWasDeleted = currentLength < previousLength;
  previousLength = currentLength;

  // Enforce max length of 5000
  if (currentText.length > 5000) {
    currentText = [currentText substringToIndex:5000];
  }

  // If text was deleted, check for tag deletions
  if (textWasDeleted && self.apiTagRanges && self.apiTagRanges.count > 0) {
    // Find what was deleted by comparing with previous text
    // This is approximate - we'll rely on regex to clean up invalid tags
    [self updateTagRangesForText:currentText];
  } else {
    // Update tag ranges based on current text
    [self updateTagRangesForText:currentText];
  }

  // Rebuild attributed string with tag highlighting
  NSMutableAttributedString *attributedString =
      [[NSMutableAttributedString alloc] initWithString:currentText];
  UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
  UIColor *textColor = [UIColor whiteColor];
  [attributedString addAttributes:@{
    NSFontAttributeName : font,
    NSForegroundColorAttributeName : textColor
  }
                            range:NSMakeRange(0, attributedString.length)];

  // Apply green background to tags - entire tag including @ symbol
  UIColor *tagColor = [UIColor colorWithRed:0.0
                                      green:0.7
                                       blue:0.4
                                      alpha:1.0]; // Better green color
  for (id tagData in self.apiTagRanges) {
    NSRange tagRange;
    UIColor *specificColor = nil;

    // Handle both NSDictionary (from studio modals) and NSValue (from text parsing)
    if ([tagData isKindOfClass:[NSDictionary class]]) {
      NSDictionary *tagInfo = (NSDictionary *)tagData;
      NSValue *rangeValue = tagInfo[@"range"];
      tagRange = [rangeValue rangeValue];
      specificColor = tagInfo[@"color"];
    } else if ([tagData isKindOfClass:[NSValue class]]) {
      tagRange = [(NSValue *)tagData rangeValue];
    } else {
      continue;
    }

    // Ensure range is valid
    if (tagRange.location + tagRange.length <= attributedString.length &&
        tagRange.length > 0) {
      // Use tag-specific color if available, otherwise default green
      [attributedString addAttribute:NSBackgroundColorAttributeName
                               value:(specificColor ?: tagColor)
                               range:tagRange];
    }
  }

  // Update text view with attributed string
  textView.attributedText = attributedString;

  // Update dynamic height (min 40, max ~150 to accommodate 3-4 lines)
  // Account for text container insets (top: 10, bottom: 10)
  CGFloat availableWidth = textView.frame.size.width > 0
                               ? textView.frame.size.width
                               : 200; // Fallback width
  CGSize size = [textView sizeThatFits:CGSizeMake(availableWidth, CGFLOAT_MAX)];
  // Add text container insets to the calculated size
  CGFloat contentHeight = size.height;
  CGFloat maxHeight = 150.0; // Max visible height before scrolling
  CGFloat newHeight =
      MAX(40, MIN(contentHeight, maxHeight)); // Increased max to 150 for 3-4 lines

  // Enable scrolling when content exceeds max visible height (fixes text navigation)
  // This allows users to scroll through long text/pasted content
  textView.scrollEnabled = (contentHeight > maxHeight);

  if (self.inputHeightConstraint &&
      fabs(self.inputHeightConstraint.constant - newHeight) > 1.0) {
    self.inputHeightConstraint.constant = newHeight;

    // Update input container height using stored constraint
    if (self.inputContainerHeightConstraint) {
      self.inputContainerHeightConstraint.constant = MAX(52, newHeight + 12);
    }

    // Calculate how much the bottom bar grew from its default height
    CGFloat defaultInputHeight = 40.0;
    CGFloat heightDelta = newHeight - defaultInputHeight;

    // Adjust preview transform to move up when bottom bar grows (if not in keyboard mode)
    // This prevents the preview from overlapping the expanded bottom bar
    if (self.previewContainerView && !self.isKeyboardVisible) {
      CATransform3D currentTransform = self.previewContainerView.layer.transform;

      // Only adjust if we have a valid transform (zoomed out state)
      if (!CATransform3DIsIdentity(currentTransform)) {
        // Calculate base transform with additional upward translation (no tilt)
        CATransform3D baseTransform = CATransform3DIdentity;
        CGFloat scale = [self isIPad] ? 0.68 : 0.55;
        baseTransform = CATransform3DScale(baseTransform, scale, scale, 1.0);

        // Base translateY plus additional offset for expanded input
        CGFloat baseTranslateY = [self isIPad] ? -120.0 : -60.0;
        CGFloat adjustedTranslateY = baseTranslateY - (heightDelta * 0.8); // Move up proportionally
        baseTransform = CATransform3DTranslate(baseTransform, 0, adjustedTranslateY, 0);

        [UIView animateWithDuration:0.2
                         animations:^{
                           self.previewContainerView.layer.transform = baseTransform;
                         }];
      }
    }

    [UIView animateWithDuration:0.2
                     animations:^{
                       [self.bottomBarView layoutIfNeeded];
                       // Ensure bottom bar stays above preview
                       if (self.bottomBarView.superview) {
                         [self.bottomBarView.superview bringSubviewToFront:self.bottomBarView];
                         // Also ensure chevron button is above
                         if (self.bottomBarChevronButton) {
                           [self.bottomBarView.superview bringSubviewToFront:self.bottomBarChevronButton];
                         }
                       }
                     }];
  }

  // Update send button visibility - but NOT if agent is running
  // When agent is running, updateSendButtonForAgentState handles visibility exclusively
  UIButton *sendButton = self.sendButton;
  if (sendButton && self.micToSendConstraint && self.micToContainerConstraint && !self.isAgentRunning) {
    BOOL hasText = currentText.length > 0;
    sendButton.hidden = !hasText;

    // Update mic button trailing constraint based on send visibility
    self.micToSendConstraint.active = hasText;
    self.micToContainerConstraint.active = !hasText;

    [UIView animateWithDuration:0.2
                     animations:^{
                       [self.bottomBarView layoutIfNeeded];
                     }];
  }
}

- (void)updateTagRangesForText:(NSString *)text {
  if (!self.apiTagRanges) {
    self.apiTagRanges = [NSMutableArray array];
  }

  // Find all @tag patterns in text - including @ symbol and optional space
  NSMutableArray *newTagRanges = [NSMutableArray array];
  NSError *error = nil;
  // Pattern matches @ followed by word characters (including hyphens, underscores, dots) and
  // optional trailing space - supports tags like @expo_logs.txt
  NSRegularExpression *regex =
      [NSRegularExpression regularExpressionWithPattern:@"@([a-zA-Z0-9-_.]+)\\s?"
                                                options:0
                                                  error:&error];

  if (!error) {
    NSArray *matches = [regex matchesInString:text
                                      options:0
                                        range:NSMakeRange(0, text.length)];
    for (NSTextCheckingResult *match in matches) {
      NSRange matchRange =
          match.range; // This includes @ symbol and the tag name
      [newTagRanges addObject:[NSValue valueWithRange:matchRange]];
    }
  }

  // Update tag ranges
  [self.apiTagRanges removeAllObjects];
  [self.apiTagRanges addObjectsFromArray:newTagRanges];
}

- (void)handleTagDeletionInRange:(NSRange)deletedRange {
  if (!self.apiTagRanges || self.apiTagRanges.count == 0) {
    return;
  }

  // Check if deleted range overlaps with any tag
  NSMutableArray *tagsToRemove = [NSMutableArray array];

  for (id tagData in self.apiTagRanges) {
    NSRange tagRange;

    // Handle both NSDictionary (from studio modals) and NSValue (from text parsing)
    if ([tagData isKindOfClass:[NSDictionary class]]) {
      NSDictionary *tagInfo = (NSDictionary *)tagData;
      NSValue *rangeValue = tagInfo[@"range"];
      tagRange = [rangeValue rangeValue];
    } else if ([tagData isKindOfClass:[NSValue class]]) {
      tagRange = [(NSValue *)tagData rangeValue];
    } else {
      continue;
    }

    // Check if deleted range overlaps with tag range
    NSRange intersection = NSIntersectionRange(deletedRange, tagRange);
    if (intersection.length > 0) {
      // Tag is being deleted - mark for removal
      [tagsToRemove addObject:tagData];
    } else if (deletedRange.location < tagRange.location) {
      // Text before tag was deleted - adjust tag range
      NSRange newTagRange =
          NSMakeRange(tagRange.location - deletedRange.length, tagRange.length);
      NSInteger index = [self.apiTagRanges indexOfObject:tagData];
      if (index != NSNotFound) {
        // Create updated entry with new range
        if ([tagData isKindOfClass:[NSDictionary class]]) {
          NSMutableDictionary *updatedTagInfo = [(NSDictionary *)tagData mutableCopy];
          updatedTagInfo[@"range"] = [NSValue valueWithRange:newTagRange];
          [self.apiTagRanges replaceObjectAtIndex:index withObject:updatedTagInfo];
        } else {
          [self.apiTagRanges replaceObjectAtIndex:index withObject:[NSValue valueWithRange:newTagRange]];
        }
      }
    }
  }

  // Remove deleted tags
  for (id tagData in tagsToRemove) {
    [self.apiTagRanges removeObject:tagData];
  }
}

- (void)updateBottomBarForKeyboardVisible:(BOOL)isVisible {
  if (!self.bottomBarView) {
    return;
  }

  // Use stored button references
  UIButton *imageButton = self.imageButton;
  UIButton *micButton = self.micButton;
  UIButton *sendButton = self.sendButton;
  UIButton *modelSelectorButton = self.modelSelectorButton;
  UITextView *inputTextView = self.inputTextView;

  if (!imageButton || !micButton || !sendButton ||
      !inputTextView) {
    return;
  }

  // Find input container (now a UIVisualEffectView)
  UIView *inputContentView = inputTextView.superview;
  UIView *inputContainer = inputContentView.superview;
  if (!inputContainer || !inputContentView) {
    return;
  }

  BOOL hasText = inputTextView.text.length > 0;

  // Check if billingMode is 'credits' (Claude agent) to show model selector
  BOOL isClaudeAgent = [self.billingMode isEqualToString:@"credits"];

  // Model selector visibility based on agent type only (not keyboard state)
  if (modelSelectorButton) {
    modelSelectorButton.hidden = !isClaudeAgent;
  }

  // Update image button leading constraint based on model selector visibility
  // When model selector is hidden, image button moves to the leading edge
  if (self.imageButtonLeadingToModelConstraint &&
      self.imageButtonLeadingToContainerConstraint) {
    self.imageButtonLeadingToModelConstraint.active = isClaudeAgent;
    self.imageButtonLeadingToContainerConstraint.active = !isClaudeAgent;
  }

  // Image button is always visible
  imageButton.hidden = NO;
  micButton.hidden = NO;        // Mic always visible
  sendButton.hidden = !hasText; // Send only if text exists

  // Input field leading constraint is always anchored to image button
  // since model selector and image are always visible
  if (self.inputFieldLeadingToImageConstraint &&
      self.inputFieldLeadingToContainerConstraint) {
    self.inputFieldLeadingToImageConstraint.active = YES;
    self.inputFieldLeadingToContainerConstraint.active = NO;
  }

  // Update constraints for mic/send positioning using stored constraints
  if (self.micToSendConstraint && self.micToContainerConstraint) {
    self.micToSendConstraint.active = hasText;
    self.micToContainerConstraint.active = !hasText;
  }

  // PERFORMANCE: Mark for layout before animation, not during
  [self.bottomBarView setNeedsLayout];

  // Use UIViewPropertyAnimator for smooth 60fps animations
  UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
      initWithDampingRatio:0.9];

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:0.25
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;
  [animator addAnimations:^{
    [weakSelf.bottomBarView layoutIfNeeded];
  }];

  [animator startAnimation];
}

- (void)handleChevronButtonTapped:(UIButton *)sender {
  // Debounce: prevent rapid taps (500ms minimum between taps)
  NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
  if (now - self.lastChatToggleTime < 0.5) {
    NSLog(@"🔵 [ZoomManager] Chat toggle debounced - too fast");
    return;
  }
  self.lastChatToggleTime = now;

  // If already loading, ignore tap
  if (self.isChatLoading) {
    NSLog(@"🔵 [ZoomManager] Chat already loading - ignoring tap");
    return;
  }

  // If chat is already visible, just hide it (no loading needed)
  if (self.isChatMode && self.chatView && self.chatView.alpha == 1.0) {
    if ([self respondsToSelector:@selector(toggleChat)]) {
      [self performSelector:@selector(toggleChat)];
    }
    return;
  }

  // Start loading state before opening chat
  [self startChatButtonLoading];

  // Toggle chat view
  if ([self respondsToSelector:@selector(toggleChat)]) {
    [self performSelector:@selector(toggleChat)];
  }
}

#pragma mark - Chat Button Loading State

- (void)startChatButtonLoading {
  if (self.isChatLoading) return;
  self.isChatLoading = YES;

  dispatch_async(dispatch_get_main_queue(), ^{
    UIButton *chatButton = self.bottomBarChevronButton;
    if (!chatButton) return;

    // Reduce opacity to indicate loading
    chatButton.alpha = 0.6;

    // Hide the title and image
    if (@available(iOS 15.0, *)) {
      UIButtonConfiguration *config = chatButton.configuration;
      if (config) {
        config.title = @"";
        config.image = nil;
        chatButton.configuration = config;
      }
    } else {
      [chatButton setTitle:@"" forState:UIControlStateNormal];
      [chatButton setImage:nil forState:UIControlStateNormal];
    }

    // Create and add spinner
    if (!self.chatButtonSpinner) {
      self.chatButtonSpinner = [[UIActivityIndicatorView alloc]
          initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
      self.chatButtonSpinner.color = [UIColor whiteColor];
      self.chatButtonSpinner.translatesAutoresizingMaskIntoConstraints = NO;
    }

    [chatButton addSubview:self.chatButtonSpinner];
    [NSLayoutConstraint activateConstraints:@[
      [self.chatButtonSpinner.centerXAnchor constraintEqualToAnchor:chatButton.centerXAnchor],
      [self.chatButtonSpinner.centerYAnchor constraintEqualToAnchor:chatButton.centerYAnchor]
    ]];

    [self.chatButtonSpinner startAnimating];
    NSLog(@"🔵 [ZoomManager] Chat button loading started");

    // Safety timeout: stop loading after 2 seconds if animation didn't complete
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      if (weakSelf.isChatLoading) {
        NSLog(@"🔵 [ZoomManager] Chat button loading timeout - forcing stop");
        [weakSelf stopChatButtonLoading];
      }
    });
  });
}

- (void)stopChatButtonLoading {
  if (!self.isChatLoading) return;
  self.isChatLoading = NO;

  dispatch_async(dispatch_get_main_queue(), ^{
    UIButton *chatButton = self.bottomBarChevronButton;
    if (!chatButton) return;

    // Stop and remove spinner
    if (self.chatButtonSpinner) {
      [self.chatButtonSpinner stopAnimating];
      [self.chatButtonSpinner removeFromSuperview];
    }

    // Restore opacity
    chatButton.alpha = 1.0;

    // Restore title and image
    if (@available(iOS 15.0, *)) {
      UIButtonConfiguration *config = chatButton.configuration;
      if (config) {
        config.title = @"Chat";
        config.image = [UIImage
            systemImageNamed:@"bubble.left.fill"
            withConfiguration:
                [UIImageSymbolConfiguration
                    configurationWithPointSize:14
                                        weight:UIImageSymbolWeightMedium]];
        config.imagePlacement = NSDirectionalRectEdgeLeading;
        config.imagePadding = 6;
        chatButton.configuration = config;
      }
    } else {
      UIImageSymbolConfiguration *chatConfig = [UIImageSymbolConfiguration
          configurationWithPointSize:14
                              weight:UIImageSymbolWeightMedium];
      UIImage *chatImage = [UIImage systemImageNamed:@"bubble.left.fill"
                                      withConfiguration:chatConfig];
      [chatButton setImage:chatImage forState:UIControlStateNormal];
      [chatButton setTitle:@"Chat" forState:UIControlStateNormal];
    }

    NSLog(@"🔵 [ZoomManager] Chat button loading stopped");
  });
}

- (void)handleAPIButtonTapped:(UIButton *)sender {
  // Show API modal
  if ([self respondsToSelector:@selector(showAPIModal)]) {
    [self performSelector:@selector(showAPIModal)];
  }
}

- (void)handleHapticButtonTapped:(UIButton *)sender {
  // Show Haptic modal
  if ([self respondsToSelector:@selector(showHapticModal)]) {
    [self performSelector:@selector(showHapticModal)];
  }
}

- (void)handleENVButtonTapped:(UIButton *)sender {
  // Show ENV modal
  if ([self respondsToSelector:@selector(showENVModal)]) {
    [self performSelector:@selector(showENVModal)];
  }
}

- (void)handleFilesButtonTapped:(UIButton *)sender {
  // Show Files modal
  if ([self respondsToSelector:@selector(showFilesModal)]) {
    [self performSelector:@selector(showFilesModal)];
  }
}

- (void)handleLogsButtonTapped:(UIButton *)sender {
  // Show Logs modal
  if ([self respondsToSelector:@selector(showLogsModal)]) {
    [self performSelector:@selector(showLogsModal)];
  }
}

- (void)handleImageStudioButtonTapped:(UIButton *)sender {
  // Show Image Studio modal
  if ([self respondsToSelector:@selector(showImageStudioModal)]) {
    [self performSelector:@selector(showImageStudioModal)];
  }
}

- (void)handleAudioStudioButtonTapped:(UIButton *)sender {
  // Show Audio Studio modal
  if ([self respondsToSelector:@selector(showAudioStudioModal)]) {
    [self performSelector:@selector(showAudioStudioModal)];
  }
}

- (void)handleVideoStudioButtonTapped:(UIButton *)sender {
  // Show Video Studio modal
  if ([self respondsToSelector:@selector(showVideoStudioModal)]) {
    [self performSelector:@selector(showVideoStudioModal)];
  }
}

- (void)handleDatabaseButtonTapped:(UIButton *)sender {
  // Show Database modal
  if ([self respondsToSelector:@selector(showDatabaseModal)]) {
    [self performSelector:@selector(showDatabaseModal)];
  }
}

- (void)handlePaymentsButtonTapped:(UIButton *)sender {
  // Show Payments modal
  if ([self respondsToSelector:@selector(showPaymentsModal)]) {
    [self performSelector:@selector(showPaymentsModal)];
  }
}

- (void)handlePublishButtonTapped:(UIButton *)sender {
  // Show Publish to App Store modal
  if ([self respondsToSelector:@selector(showPublishModal)]) {
    [self performSelector:@selector(showPublishModal)];
  }
}

- (void)handleSendButtonTapped:(UIButton *)sender {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  // Prevent duplicate clicks during upload
  if (self.isUploadingImage) {
    return;
  }

  // Block sending while agent is running
  if (self.isAgentRunning) {
    NSLog(@"🚫 [BottomBar] Send blocked - agent is currently running");
    return;
  }

  // Check billing status - block if user cannot send
  if (!self.canSendMessage) {
    NSLog(@"🚫 [Billing] Send blocked - user has no tokens/credits");
    // Show the billing limit alert
    if ([self respondsToSelector:@selector(showBillingLimitReachedAlert)]) {
      [self performSelector:@selector(showBillingLimitReachedAlert)];
    }
    return;
  }

  // Get text from attributed string if available, otherwise plain text
  NSString *messageText = @"";
  if (inputTextView.attributedText) {
    messageText = [inputTextView.attributedText.string
        stringByTrimmingCharactersInSet:[NSCharacterSet
                                            whitespaceAndNewlineCharacterSet]];
  } else {
    messageText = [inputTextView.text
        stringByTrimmingCharactersInSet:[NSCharacterSet
                                            whitespaceAndNewlineCharacterSet]];
  }

  // Check if there's text OR pending images to send
  BOOL hasText = messageText.length > 0;
  BOOL hasImages = self.pendingImageAttachments && self.pendingImageAttachments.count > 0;

  if ((hasText || hasImages) && !self.isSendingMessage && self.chatSessionId) {
    // Set flag to prevent notification handler from interfering
    self.isResettingInput = YES;

    // Log Facebook event for VibraCreateApp (user sending a prompt to create/modify app)
    [FBSDKAppEvents.shared logEvent:@"VibraCreateApp"
                         parameters:@{
                           @"has_text": hasText ? @"yes" : @"no",
                           @"has_images": hasImages ? @"yes" : @"no"
                         }];

    // Call sendChatMessage from ChatView category
    if ([self respondsToSelector:@selector(sendChatMessage:)]) {
      [self performSelector:@selector(sendChatMessage:) withObject:messageText];

      // Clear text immediately
      inputTextView.text = @"Message";
      inputTextView.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
      inputTextView.attributedText = nil;

      // Clear tag ranges
      if (self.apiTagRanges) {
        [self.apiTagRanges removeAllObjects];
      }

      // Clear path mappings (paths have been sent with message)
      if (self.imagePathMappings) {
        [self.imagePathMappings removeAllObjects];
      }
      if (self.videoPathMappings) {
        [self.videoPathMappings removeAllObjects];
      }
      if (self.audioPathMappings) {
        [self.audioPathMappings removeAllObjects];
      }

      // Reset height constraint
      if (self.inputHeightConstraint) {
        self.inputHeightConstraint.constant = 40;
      }

      // Reset input container height using stored constraint
      if (self.inputContainerHeightConstraint) {
        self.inputContainerHeightConstraint.constant = 52;
      }

      // Hide send button and update mic position
      UIButton *sendButton = self.sendButton;
      if (sendButton && self.micToSendConstraint && self.micToContainerConstraint) {
        sendButton.hidden = YES;
        self.micToSendConstraint.active = NO;
        self.micToContainerConstraint.active = YES;
      }

      // Apply layout without animation to prevent shifting
      [inputTextView setNeedsLayout];
      [inputTextView layoutIfNeeded];
      [self.bottomBarView setNeedsLayout];
      [self.bottomBarView layoutIfNeeded];

      // Clear flag after layout is done
      self.isResettingInput = NO;

      // Refresh billing status after sending (in case balance changed)
      if ([self respondsToSelector:@selector(checkBillingStatusWithCompletion:)]) {
        [self performSelector:@selector(checkBillingStatusWithCompletion:) withObject:nil];
      }
    }
  }
}

#pragma mark - UITextViewDelegate

- (void)textViewDidBeginEditing:(UITextView *)textView {
  // Clear placeholder
  if ([textView.text isEqualToString:@"Message"]) {
    textView.text = @"";
    textView.textColor = [UIColor whiteColor];
  }
}

- (void)textViewDidEndEditing:(UITextView *)textView {
  // Restore placeholder if empty
  if (textView.text.length == 0) {
    textView.text = @"Message";
    textView.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
  }
}

#pragma mark - Image Picker

- (void)handleImageButtonTapped:(UIButton *)sender {
  [self showImagePicker];
}

- (void)showImagePicker {
  UIViewController *presentingVC = nil;
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  presentingVC = rootVC;
  
  if (!presentingVC) {
    return;
  }
  
  if (@available(iOS 14.0, *)) {
    PHPickerConfiguration *config = [[PHPickerConfiguration alloc] init];
    config.selectionLimit = 5;
    config.filter = [PHPickerFilter imagesFilter];
    
    PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:config];
    picker.delegate = (id<PHPickerViewControllerDelegate>)self;
    picker.modalPresentationStyle = UIModalPresentationAutomatic;
    
    [presentingVC presentViewController:picker animated:YES completion:nil];
  } else {
    UIImagePickerController *picker = [[UIImagePickerController alloc] init];
    picker.delegate = (id<UIImagePickerControllerDelegate, UINavigationControllerDelegate>)self;
    picker.sourceType = UIImagePickerControllerSourceTypePhotoLibrary;
    picker.allowsEditing = NO;
    
    [presentingVC presentViewController:picker animated:YES completion:nil];
  }
}

#pragma mark - PHPickerViewControllerDelegate

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results API_AVAILABLE(ios(14.0)) {
  [picker dismissViewControllerAnimated:YES completion:nil];
  
  if (results.count == 0) {
    return;
  }
  
  for (PHPickerResult *result in results) {
    NSItemProvider *itemProvider = result.itemProvider;
    
    if ([itemProvider canLoadObjectOfClass:[UIImage class]]) {
      __weak typeof(self) weakSelf = self;
      [itemProvider loadObjectOfClass:[UIImage class] completionHandler:^(id _Nullable object, NSError * _Nullable error) {
        if (error) {
          NSLog(@"Error loading image: %@", error);
          return;
        }
        
        if ([object isKindOfClass:[UIImage class]]) {
          UIImage *image = (UIImage *)object;
          NSString *fileName = [NSString stringWithFormat:@"image_%@.jpg", [[NSUUID UUID] UUIDString]];
          
          dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf addImageAttachment:image fileName:fileName];
          });
        }
      }];
    }
  }
}

#pragma mark - UIImagePickerControllerDelegate

- (void)imagePickerController:(UIImagePickerController *)picker didFinishPickingMediaWithInfo:(NSDictionary<UIImagePickerControllerInfoKey, id> *)info {
  [picker dismissViewControllerAnimated:YES completion:nil];
  
  UIImage *image = info[UIImagePickerControllerOriginalImage];
  if (image) {
    NSString *fileName = [NSString stringWithFormat:@"image_%@.jpg", [[NSUUID UUID] UUIDString]];
    [self addImageAttachment:image fileName:fileName];
  }
}

- (void)imagePickerControllerDidCancel:(UIImagePickerController *)picker {
  [picker dismissViewControllerAnimated:YES completion:nil];
}

#pragma mark - Image Attachment Management

- (void)addImageAttachment:(UIImage *)image fileName:(NSString *)fileName {
  [self addImageAttachment:image fileName:fileName sandboxPath:nil];
}

- (void)addImageAttachment:(UIImage *)image fileName:(NSString *)fileName sandboxPath:(NSString *)sandboxPath {
  if (!self.pendingImageAttachments) {
    self.pendingImageAttachments = [NSMutableArray array];
  }

  if (self.pendingImageAttachments.count >= 5) {
    return;
  }

  NSMutableDictionary *attachment = [NSMutableDictionary dictionaryWithDictionary:@{
    @"image": image,
    @"fileName": fileName,
    @"id": [[NSUUID UUID] UUIDString]
  }];

  // If sandbox path provided, store it so we don't re-upload
  if (sandboxPath && sandboxPath.length > 0) {
    attachment[@"sandboxPath"] = sandboxPath;
  }

  [self.pendingImageAttachments addObject:attachment];
  [self updateImagePreviewContainer];
}

- (void)removeImageAttachment:(NSInteger)index {
  if (index >= 0 && index < self.pendingImageAttachments.count) {
    [self.pendingImageAttachments removeObjectAtIndex:index];
    [self updateImagePreviewContainer];
  }
}

- (void)clearAllImageAttachments {
  [self.pendingImageAttachments removeAllObjects];
  [self updateImagePreviewContainer];
}

- (void)updateImagePreviewContainer {
  UIView *inputContentView = self.inputTextView.superview;
  UIView *inputContainer = inputContentView.superview;
  UIView *contentView = inputContainer.superview;

  if (!contentView) {
    return;
  }

  if (self.imagePreviewContainer) {
    [self.imagePreviewContainer removeFromSuperview];
    self.imagePreviewContainer = nil;
  }

  // Calculate bottom bar heights
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }
  CGFloat baseBottomBarHeight = 16 + 52 + 16 + 60 + safeAreaBottom; // Normal bottom bar height

  if (self.pendingImageAttachments.count == 0) {
    for (NSLayoutConstraint *constraint in inputContainer.superview.constraints) {
      if (constraint.firstItem == inputContainer && constraint.firstAttribute == NSLayoutAttributeTop) {
        constraint.constant = 12;
        break;
      }
    }

    // Restore preview position when no images attached (no tilt)
    if (self.previewContainerView && self.isZoomed && !self.isChatMode) {
      CATransform3D transform = CATransform3DIdentity;
      CGFloat scale = [self isIPad] ? 0.68 : 0.55;
      transform = CATransform3DScale(transform, scale, scale, 1.0);
      // Move preview UP to position it higher on screen
      CGFloat translateY = [self isIPad] ? -120.0 : -60.0;
      transform = CATransform3DTranslate(transform, 0, translateY, 0);

      [UIView animateWithDuration:0.25 animations:^{
        self.previewContainerView.layer.transform = transform;
      }];
    }

    // Restore chat scroll view bottom constraint when no images
    if (self.isChatMode && self.chatScrollViewBottomConstraint) {
      self.chatScrollViewBottomConstraint.constant = -baseBottomBarHeight;
      [UIView animateWithDuration:0.2 animations:^{
        [self.chatScrollView.superview layoutIfNeeded];
      }];
    }

    [UIView animateWithDuration:0.2 animations:^{
      [self.bottomBarView layoutIfNeeded];
    }];
    return;
  }

  self.imagePreviewContainer = [[UIView alloc] init];
  self.imagePreviewContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.imagePreviewContainer.backgroundColor = [UIColor clearColor];
  self.imagePreviewContainer.userInteractionEnabled = YES; // Allow touches on remove buttons
  [contentView addSubview:self.imagePreviewContainer];
  [contentView sendSubviewToBack:self.imagePreviewContainer]; // Keep behind inputContainer

  // Ensure preview stays behind bottom bar
  if (self.previewContainerView) {
    self.previewContainerView.layer.zPosition = -100;
  }

  [NSLayoutConstraint activateConstraints:@[
    [self.imagePreviewContainer.topAnchor constraintEqualToAnchor:contentView.topAnchor constant:12],
    [self.imagePreviewContainer.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor constant:16],
    [self.imagePreviewContainer.trailingAnchor constraintEqualToAnchor:contentView.trailingAnchor constant:-16],
    [self.imagePreviewContainer.heightAnchor constraintEqualToConstant:60]
  ]];

  for (NSLayoutConstraint *constraint in contentView.constraints) {
    if (constraint.firstItem == inputContainer && constraint.firstAttribute == NSLayoutAttributeTop) {
      constraint.constant = 76;
      break;
    }
  }

  // Push preview up when images are attached (similar to chat mode, no tilt)
  if (self.previewContainerView && self.isZoomed && !self.isChatMode) {
    CATransform3D transform = CATransform3DIdentity;
    CGFloat scale = [self isIPad] ? 0.68 : 0.55;
    transform = CATransform3DScale(transform, scale, scale, 1.0);
    // Base offset + extra for image preview container
    // iPad: -120 base + -40 extra = -160, iPhone: -60 base + -32 extra = -92
    CGFloat translateY = [self isIPad] ? -160.0 : -92.0;
    transform = CATransform3DTranslate(transform, 0, translateY, 0);

    [UIView animateWithDuration:0.25 animations:^{
      self.previewContainerView.layer.transform = transform;
    }];
  }

  // Adjust chat scroll view bottom constraint when images are attached
  if (self.isChatMode && self.chatScrollViewBottomConstraint) {
    // Add 64 points (image preview height + spacing) to the bottom constraint
    self.chatScrollViewBottomConstraint.constant = -(baseBottomBarHeight + 64);
    [UIView animateWithDuration:0.2 animations:^{
      [self.chatScrollView.superview layoutIfNeeded];
    }];
  }

  UIScrollView *scrollView = [[UIScrollView alloc] init];
  scrollView.translatesAutoresizingMaskIntoConstraints = NO;
  scrollView.showsHorizontalScrollIndicator = NO;
  scrollView.showsVerticalScrollIndicator = NO;
  [self.imagePreviewContainer addSubview:scrollView];

  [NSLayoutConstraint activateConstraints:@[
    [scrollView.topAnchor constraintEqualToAnchor:self.imagePreviewContainer.topAnchor],
    [scrollView.leadingAnchor constraintEqualToAnchor:self.imagePreviewContainer.leadingAnchor],
    [scrollView.trailingAnchor constraintEqualToAnchor:self.imagePreviewContainer.trailingAnchor],
    [scrollView.bottomAnchor constraintEqualToAnchor:self.imagePreviewContainer.bottomAnchor]
  ]];

  UIView *stackContainer = [[UIView alloc] init];
  stackContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [scrollView addSubview:stackContainer];

  [NSLayoutConstraint activateConstraints:@[
    [stackContainer.topAnchor constraintEqualToAnchor:scrollView.topAnchor],
    [stackContainer.leadingAnchor constraintEqualToAnchor:scrollView.leadingAnchor],
    [stackContainer.trailingAnchor constraintEqualToAnchor:scrollView.trailingAnchor],
    [stackContainer.bottomAnchor constraintEqualToAnchor:scrollView.bottomAnchor],
    [stackContainer.heightAnchor constraintEqualToAnchor:scrollView.heightAnchor]
  ]];

  UIView *previousView = nil;
  for (NSInteger i = 0; i < self.pendingImageAttachments.count; i++) {
    NSDictionary *attachment = self.pendingImageAttachments[i];
    UIImage *image = attachment[@"image"];

    UIView *imageWrapper = [[UIView alloc] init];
    imageWrapper.translatesAutoresizingMaskIntoConstraints = NO;
    [stackContainer addSubview:imageWrapper];

    // Checkerboard background (matches ImageStudioModal for transparency)
    UIView *checkerboardView = [[UIView alloc] init];
    checkerboardView.translatesAutoresizingMaskIntoConstraints = NO;
    checkerboardView.layer.cornerRadius = 12;
    checkerboardView.clipsToBounds = YES;

    // Create checkerboard pattern
    CGFloat squareSize = 6.0;
    CGFloat patternSize = squareSize * 2;
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(patternSize, patternSize), YES, 0);
    UIColor *darkColor = [UIColor colorWithRed:0.1 green:0.1 blue:0.1 alpha:1.0];
    UIColor *lightColor = [UIColor colorWithRed:0.15 green:0.15 blue:0.15 alpha:1.0];
    [darkColor setFill];
    UIRectFill(CGRectMake(0, 0, squareSize, squareSize));
    UIRectFill(CGRectMake(squareSize, squareSize, squareSize, squareSize));
    [lightColor setFill];
    UIRectFill(CGRectMake(squareSize, 0, squareSize, squareSize));
    UIRectFill(CGRectMake(0, squareSize, squareSize, squareSize));
    UIImage *patternImage = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    checkerboardView.backgroundColor = [UIColor colorWithPatternImage:patternImage];
    [imageWrapper addSubview:checkerboardView];

    UIImageView *imageView = [[UIImageView alloc] initWithImage:image];
    imageView.translatesAutoresizingMaskIntoConstraints = NO;
    imageView.contentMode = UIViewContentModeScaleAspectFill;
    imageView.clipsToBounds = YES;
    imageView.layer.cornerRadius = 12;
    [imageWrapper addSubview:imageView];

    // Remove badge (matches ImageStudioModal selection badge style)
    UIView *removeBadge = [[UIView alloc] init];
    removeBadge.translatesAutoresizingMaskIntoConstraints = NO;
    removeBadge.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    removeBadge.layer.cornerRadius = 10;
    removeBadge.clipsToBounds = YES;
    [imageWrapper addSubview:removeBadge];

    UIButton *removeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    removeButton.translatesAutoresizingMaskIntoConstraints = NO;
    removeButton.tag = i;
    removeButton.backgroundColor = [UIColor clearColor];

    UIImageSymbolConfiguration *xConfig = [UIImageSymbolConfiguration configurationWithPointSize:10 weight:UIImageSymbolWeightBold];
    UIImage *xImage = [UIImage systemImageNamed:@"xmark" withConfiguration:xConfig];
    [removeButton setImage:xImage forState:UIControlStateNormal];
    removeButton.tintColor = [UIColor whiteColor];
    [removeButton addTarget:self action:@selector(handleRemoveImageTapped:) forControlEvents:UIControlEventTouchUpInside];
    [removeBadge addSubview:removeButton];

    [NSLayoutConstraint activateConstraints:@[
      [imageWrapper.topAnchor constraintEqualToAnchor:stackContainer.topAnchor],
      [imageWrapper.bottomAnchor constraintEqualToAnchor:stackContainer.bottomAnchor],
      [imageWrapper.widthAnchor constraintEqualToConstant:60],

      [checkerboardView.topAnchor constraintEqualToAnchor:imageWrapper.topAnchor constant:4],
      [checkerboardView.leadingAnchor constraintEqualToAnchor:imageWrapper.leadingAnchor],
      [checkerboardView.widthAnchor constraintEqualToConstant:52],
      [checkerboardView.heightAnchor constraintEqualToConstant:52],

      [imageView.topAnchor constraintEqualToAnchor:checkerboardView.topAnchor],
      [imageView.leadingAnchor constraintEqualToAnchor:checkerboardView.leadingAnchor],
      [imageView.trailingAnchor constraintEqualToAnchor:checkerboardView.trailingAnchor],
      [imageView.bottomAnchor constraintEqualToAnchor:checkerboardView.bottomAnchor],

      [removeBadge.topAnchor constraintEqualToAnchor:imageWrapper.topAnchor],
      [removeBadge.trailingAnchor constraintEqualToAnchor:imageWrapper.trailingAnchor],
      [removeBadge.widthAnchor constraintEqualToConstant:20],
      [removeBadge.heightAnchor constraintEqualToConstant:20],

      [removeButton.topAnchor constraintEqualToAnchor:removeBadge.topAnchor],
      [removeButton.leadingAnchor constraintEqualToAnchor:removeBadge.leadingAnchor],
      [removeButton.trailingAnchor constraintEqualToAnchor:removeBadge.trailingAnchor],
      [removeButton.bottomAnchor constraintEqualToAnchor:removeBadge.bottomAnchor]
    ]];

    if (previousView) {
      [imageWrapper.leadingAnchor constraintEqualToAnchor:previousView.trailingAnchor constant:8].active = YES;
    } else {
      [imageWrapper.leadingAnchor constraintEqualToAnchor:stackContainer.leadingAnchor].active = YES;
    }

    previousView = imageWrapper;
  }

  if (previousView) {
    [previousView.trailingAnchor constraintEqualToAnchor:stackContainer.trailingAnchor].active = YES;
  }

  if (self.pendingImageAttachments.count > 1) {
    UIButton *clearAllButton = [UIButton buttonWithType:UIButtonTypeSystem];
    clearAllButton.translatesAutoresizingMaskIntoConstraints = NO;
    clearAllButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
    clearAllButton.layer.cornerRadius = 12;
    clearAllButton.clipsToBounds = YES;
    [clearAllButton setTitle:@"Clear" forState:UIControlStateNormal];
    clearAllButton.titleLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightMedium];
    [clearAllButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    [clearAllButton addTarget:self action:@selector(handleClearAllImagesTapped:) forControlEvents:UIControlEventTouchUpInside];
    [self.imagePreviewContainer addSubview:clearAllButton];

    [NSLayoutConstraint activateConstraints:@[
      [clearAllButton.trailingAnchor constraintEqualToAnchor:self.imagePreviewContainer.trailingAnchor],
      [clearAllButton.centerYAnchor constraintEqualToAnchor:self.imagePreviewContainer.centerYAnchor],
      [clearAllButton.widthAnchor constraintEqualToConstant:50],
      [clearAllButton.heightAnchor constraintEqualToConstant:24]
    ]];
  }

  [UIView animateWithDuration:0.2 animations:^{
    [self.bottomBarView layoutIfNeeded];
  }];
}

- (void)handleRemoveImageTapped:(UIButton *)sender {
  [self removeImageAttachment:sender.tag];
}

- (void)handleClearAllImagesTapped:(UIButton *)sender {
  [self clearAllImageAttachments];
}

#pragma mark - Audio Attachment Methods

// Purple accent color for audio (matches Audio Studio Modal)
static UIColor *AudioPreviewAccentColor(void) {
  return [UIColor colorWithRed:0.6 green:0.4 blue:0.9 alpha:1.0];
}

- (void)addAudioAttachment:(NSData *)audioData fileName:(NSString *)fileName {
  if (!self.pendingAudioAttachments) {
    self.pendingAudioAttachments = [NSMutableArray array];
  }

  // Max 5 audio attachments
  if (self.pendingAudioAttachments.count >= 5) {
    NSLog(@"🎵 [BottomBar] Max 5 audios reached, ignoring add");
    return;
  }

  NSMutableDictionary *attachment = [NSMutableDictionary dictionaryWithDictionary:@{
    @"data": audioData,
    @"fileName": fileName,
    @"id": [[NSUUID UUID] UUIDString]
  }];

  [self.pendingAudioAttachments addObject:attachment];
  NSLog(@"🎵 [BottomBar] Added audio attachment: %@, total: %lu", fileName, (unsigned long)self.pendingAudioAttachments.count);
  [self updateAudioPreviewContainer];
}

- (void)removeAudioAttachment:(NSInteger)index {
  if (index >= 0 && index < self.pendingAudioAttachments.count) {
    [self.pendingAudioAttachments removeObjectAtIndex:index];
    [self updateAudioPreviewContainer];
  }
}

- (void)clearAllAudioAttachments {
  [self.pendingAudioAttachments removeAllObjects];
  [self updateAudioPreviewContainer];
}

- (void)updateAudioPreviewContainer {
  // Get the same view hierarchy as image preview
  UIView *inputContentView = self.inputTextView.superview;
  UIView *inputContainer = inputContentView.superview;
  UIView *contentView = inputContainer.superview;

  if (!contentView) {
    return;
  }

  // Always remove existing container first (matches image preview behavior)
  if (self.audioPreviewContainer) {
    [self.audioPreviewContainer removeFromSuperview];
    self.audioPreviewContainer = nil;
  }

  // Calculate bottom bar heights for chat scroll adjustment
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }
  CGFloat baseBottomBarHeight = 16 + 52 + 16 + 60 + safeAreaBottom;

  // Early return if no audios - restore constraints
  if (!self.pendingAudioAttachments || self.pendingAudioAttachments.count == 0) {
    // Restore inputContainer top constraint to 12 (default position)
    for (NSLayoutConstraint *constraint in contentView.constraints) {
      if (constraint.firstItem == inputContainer && constraint.firstAttribute == NSLayoutAttributeTop) {
        constraint.constant = 12;
        break;
      }
    }

    // Restore preview position when no audios attached
    if (self.previewContainerView && self.isZoomed && !self.isChatMode) {
      CATransform3D transform = CATransform3DIdentity;
      CGFloat scale = [self isIPad] ? 0.68 : 0.55;
      transform = CATransform3DScale(transform, scale, scale, 1.0);
      CGFloat translateY = [self isIPad] ? -120.0 : -60.0;
      transform = CATransform3DTranslate(transform, 0, translateY, 0);
      [UIView animateWithDuration:0.25 animations:^{
        self.previewContainerView.layer.transform = transform;
      }];
    }

    // Restore chat scroll view bottom constraint
    if (self.isChatMode && self.chatScrollViewBottomConstraint) {
      self.chatScrollViewBottomConstraint.constant = -baseBottomBarHeight;
      [UIView animateWithDuration:0.2 animations:^{
        [self.chatScrollView.superview layoutIfNeeded];
      }];
    }

    [UIView animateWithDuration:0.2 animations:^{
      [self.bottomBarView layoutIfNeeded];
    }];
    return;
  }

  // Create container and add to contentView (INSIDE bottom bar, same as images)
  self.audioPreviewContainer = [[UIView alloc] init];
  self.audioPreviewContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.audioPreviewContainer.backgroundColor = [UIColor clearColor];
  self.audioPreviewContainer.userInteractionEnabled = YES;
  [contentView addSubview:self.audioPreviewContainer];
  [contentView sendSubviewToBack:self.audioPreviewContainer];

  // Ensure preview stays behind bottom bar
  if (self.previewContainerView) {
    self.previewContainerView.layer.zPosition = -100;
  }

  // Position at TOP of contentView (SAME as image preview)
  [NSLayoutConstraint activateConstraints:@[
    [self.audioPreviewContainer.topAnchor constraintEqualToAnchor:contentView.topAnchor constant:12],
    [self.audioPreviewContainer.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor constant:16],
    [self.audioPreviewContainer.trailingAnchor constraintEqualToAnchor:contentView.trailingAnchor constant:-16],
    [self.audioPreviewContainer.heightAnchor constraintEqualToConstant:60]
  ]];

  // Push inputContainer down to make room (SAME as image preview)
  for (NSLayoutConstraint *constraint in contentView.constraints) {
    if (constraint.firstItem == inputContainer && constraint.firstAttribute == NSLayoutAttributeTop) {
      constraint.constant = 76;
      break;
    }
  }

  // Push preview up when audios attached (SAME as image preview)
  if (self.previewContainerView && self.isZoomed && !self.isChatMode) {
    CATransform3D transform = CATransform3DIdentity;
    CGFloat scale = [self isIPad] ? 0.68 : 0.55;
    transform = CATransform3DScale(transform, scale, scale, 1.0);
    CGFloat translateY = [self isIPad] ? -160.0 : -92.0;
    transform = CATransform3DTranslate(transform, 0, translateY, 0);
    [UIView animateWithDuration:0.25 animations:^{
      self.previewContainerView.layer.transform = transform;
    }];
  }

  // Adjust chat scroll view bottom constraint when audios attached
  if (self.isChatMode && self.chatScrollViewBottomConstraint) {
    self.chatScrollViewBottomConstraint.constant = -(baseBottomBarHeight + 64);
    [UIView animateWithDuration:0.2 animations:^{
      [self.chatScrollView.superview layoutIfNeeded];
    }];
  }

  // Create horizontal scroll view (SAME as image preview)
  UIScrollView *scrollView = [[UIScrollView alloc] init];
  scrollView.translatesAutoresizingMaskIntoConstraints = NO;
  scrollView.showsHorizontalScrollIndicator = NO;
  scrollView.showsVerticalScrollIndicator = NO;
  [self.audioPreviewContainer addSubview:scrollView];

  [NSLayoutConstraint activateConstraints:@[
    [scrollView.topAnchor constraintEqualToAnchor:self.audioPreviewContainer.topAnchor],
    [scrollView.leadingAnchor constraintEqualToAnchor:self.audioPreviewContainer.leadingAnchor],
    [scrollView.trailingAnchor constraintEqualToAnchor:self.audioPreviewContainer.trailingAnchor],
    [scrollView.bottomAnchor constraintEqualToAnchor:self.audioPreviewContainer.bottomAnchor]
  ]];

  UIView *stackContainer = [[UIView alloc] init];
  stackContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [scrollView addSubview:stackContainer];

  [NSLayoutConstraint activateConstraints:@[
    [stackContainer.topAnchor constraintEqualToAnchor:scrollView.topAnchor],
    [stackContainer.leadingAnchor constraintEqualToAnchor:scrollView.leadingAnchor],
    [stackContainer.trailingAnchor constraintEqualToAnchor:scrollView.trailingAnchor],
    [stackContainer.bottomAnchor constraintEqualToAnchor:scrollView.bottomAnchor],
    [stackContainer.heightAnchor constraintEqualToAnchor:scrollView.heightAnchor]
  ]];

  UIView *previousView = nil;
  for (NSInteger i = 0; i < self.pendingAudioAttachments.count; i++) {
    // EXACT same wrapper as image cells - 60pt wide
    UIView *audioWrapper = [[UIView alloc] init];
    audioWrapper.translatesAutoresizingMaskIntoConstraints = NO;
    [stackContainer addSubview:audioWrapper];

    // Content background - 52x52 with 12pt corner radius (same as image cells)
    UIView *contentBackground = [[UIView alloc] init];
    contentBackground.translatesAutoresizingMaskIntoConstraints = NO;
    contentBackground.backgroundColor = [AudioPreviewAccentColor() colorWithAlphaComponent:0.25];
    contentBackground.layer.cornerRadius = 12;
    contentBackground.clipsToBounds = YES;
    [audioWrapper addSubview:contentBackground];

    // Centered waveform icon (replaces image)
    UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
    UIImageView *audioIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"waveform" withConfiguration:iconConfig]];
    audioIcon.translatesAutoresizingMaskIntoConstraints = NO;
    audioIcon.tintColor = AudioPreviewAccentColor();
    [contentBackground addSubview:audioIcon];

    // Remove badge - EXACT same as image cells (20x20 red circle, top-right)
    UIView *removeBadge = [[UIView alloc] init];
    removeBadge.translatesAutoresizingMaskIntoConstraints = NO;
    removeBadge.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    removeBadge.layer.cornerRadius = 10;
    removeBadge.clipsToBounds = YES;
    [audioWrapper addSubview:removeBadge];

    UIButton *removeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    removeButton.translatesAutoresizingMaskIntoConstraints = NO;
    removeButton.tag = i;
    removeButton.backgroundColor = [UIColor clearColor];

    UIImageSymbolConfiguration *xConfig = [UIImageSymbolConfiguration configurationWithPointSize:10 weight:UIImageSymbolWeightBold];
    UIImage *xImage = [UIImage systemImageNamed:@"xmark" withConfiguration:xConfig];
    [removeButton setImage:xImage forState:UIControlStateNormal];
    removeButton.tintColor = [UIColor whiteColor];
    [removeButton addTarget:self action:@selector(handleRemoveAudioTapped:) forControlEvents:UIControlEventTouchUpInside];
    [removeBadge addSubview:removeButton];

    // EXACT same constraints as image cells
    [NSLayoutConstraint activateConstraints:@[
      [audioWrapper.topAnchor constraintEqualToAnchor:stackContainer.topAnchor],
      [audioWrapper.bottomAnchor constraintEqualToAnchor:stackContainer.bottomAnchor],
      [audioWrapper.widthAnchor constraintEqualToConstant:60],

      [contentBackground.topAnchor constraintEqualToAnchor:audioWrapper.topAnchor constant:4],
      [contentBackground.leadingAnchor constraintEqualToAnchor:audioWrapper.leadingAnchor],
      [contentBackground.widthAnchor constraintEqualToConstant:52],
      [contentBackground.heightAnchor constraintEqualToConstant:52],

      [audioIcon.centerXAnchor constraintEqualToAnchor:contentBackground.centerXAnchor],
      [audioIcon.centerYAnchor constraintEqualToAnchor:contentBackground.centerYAnchor],

      [removeBadge.topAnchor constraintEqualToAnchor:audioWrapper.topAnchor],
      [removeBadge.trailingAnchor constraintEqualToAnchor:audioWrapper.trailingAnchor],
      [removeBadge.widthAnchor constraintEqualToConstant:20],
      [removeBadge.heightAnchor constraintEqualToConstant:20],

      [removeButton.topAnchor constraintEqualToAnchor:removeBadge.topAnchor],
      [removeButton.leadingAnchor constraintEqualToAnchor:removeBadge.leadingAnchor],
      [removeButton.trailingAnchor constraintEqualToAnchor:removeBadge.trailingAnchor],
      [removeButton.bottomAnchor constraintEqualToAnchor:removeBadge.bottomAnchor]
    ]];

    // EXACT same spacing as image cells - 8pt between items
    if (previousView) {
      [audioWrapper.leadingAnchor constraintEqualToAnchor:previousView.trailingAnchor constant:8].active = YES;
    } else {
      [audioWrapper.leadingAnchor constraintEqualToAnchor:stackContainer.leadingAnchor].active = YES;
    }

    previousView = audioWrapper;
  }

  if (previousView) {
    [previousView.trailingAnchor constraintEqualToAnchor:stackContainer.trailingAnchor].active = YES;
  }

  // Clear all button - EXACT same as image cells (only when > 1)
  if (self.pendingAudioAttachments.count > 1) {
    UIButton *clearAllButton = [UIButton buttonWithType:UIButtonTypeSystem];
    clearAllButton.translatesAutoresizingMaskIntoConstraints = NO;
    clearAllButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
    clearAllButton.layer.cornerRadius = 12;
    clearAllButton.clipsToBounds = YES;
    [clearAllButton setTitle:@"Clear" forState:UIControlStateNormal];
    clearAllButton.titleLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightMedium];
    [clearAllButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    [clearAllButton addTarget:self action:@selector(handleClearAllAudiosTapped:) forControlEvents:UIControlEventTouchUpInside];
    [self.audioPreviewContainer addSubview:clearAllButton];

    [NSLayoutConstraint activateConstraints:@[
      [clearAllButton.trailingAnchor constraintEqualToAnchor:self.audioPreviewContainer.trailingAnchor],
      [clearAllButton.centerYAnchor constraintEqualToAnchor:self.audioPreviewContainer.centerYAnchor],
      [clearAllButton.widthAnchor constraintEqualToConstant:50],
      [clearAllButton.heightAnchor constraintEqualToConstant:24]
    ]];
  }

  [UIView animateWithDuration:0.2 animations:^{
    [self.bottomBarView layoutIfNeeded];
  }];
}

- (void)handleRemoveAudioTapped:(UIButton *)sender {
  [self removeAudioAttachment:sender.tag];
}

- (void)handleClearAllAudiosTapped:(UIButton *)sender {
  [self clearAllAudioAttachments];
}

#pragma mark - Video Attachment Methods

// Coral/orange accent color for video (matches Video Studio Modal)
static UIColor *VideoPreviewAccentColor(void) {
  return [UIColor colorWithRed:0.95 green:0.5 blue:0.3 alpha:1.0];
}

- (void)addVideoAttachment:(NSData *)videoData fileName:(NSString *)fileName {
  if (!self.pendingVideoAttachments) {
    self.pendingVideoAttachments = [NSMutableArray array];
  }

  // Max 5 video attachments
  if (self.pendingVideoAttachments.count >= 5) {
    NSLog(@"🎬 [BottomBar] Max 5 videos reached, ignoring add");
    return;
  }

  NSMutableDictionary *attachment = [NSMutableDictionary dictionaryWithDictionary:@{
    @"data": videoData,
    @"fileName": fileName,
    @"id": [[NSUUID UUID] UUIDString]
  }];

  [self.pendingVideoAttachments addObject:attachment];
  NSLog(@"🎬 [BottomBar] Added video attachment: %@, total: %lu", fileName, (unsigned long)self.pendingVideoAttachments.count);
  [self updateVideoPreviewContainer];
}

- (void)removeVideoAttachment:(NSInteger)index {
  if (index >= 0 && index < self.pendingVideoAttachments.count) {
    [self.pendingVideoAttachments removeObjectAtIndex:index];
    [self updateVideoPreviewContainer];
  }
}

- (void)clearAllVideoAttachments {
  [self.pendingVideoAttachments removeAllObjects];
  [self updateVideoPreviewContainer];
}

- (void)updateVideoPreviewContainer {
  // Get the same view hierarchy as image preview
  UIView *inputContentView = self.inputTextView.superview;
  UIView *inputContainer = inputContentView.superview;
  UIView *contentView = inputContainer.superview;

  if (!contentView) {
    return;
  }

  // Always remove existing container first (matches image preview behavior)
  if (self.videoPreviewContainer) {
    [self.videoPreviewContainer removeFromSuperview];
    self.videoPreviewContainer = nil;
  }

  // Calculate bottom bar heights for chat scroll adjustment
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }
  CGFloat baseBottomBarHeight = 16 + 52 + 16 + 60 + safeAreaBottom;

  // Early return if no videos - restore constraints
  if (!self.pendingVideoAttachments || self.pendingVideoAttachments.count == 0) {
    // Restore inputContainer top constraint to 12 (default position)
    for (NSLayoutConstraint *constraint in contentView.constraints) {
      if (constraint.firstItem == inputContainer && constraint.firstAttribute == NSLayoutAttributeTop) {
        constraint.constant = 12;
        break;
      }
    }

    // Restore preview position when no videos attached
    if (self.previewContainerView && self.isZoomed && !self.isChatMode) {
      CATransform3D transform = CATransform3DIdentity;
      CGFloat scale = [self isIPad] ? 0.68 : 0.55;
      transform = CATransform3DScale(transform, scale, scale, 1.0);
      CGFloat translateY = [self isIPad] ? -120.0 : -60.0;
      transform = CATransform3DTranslate(transform, 0, translateY, 0);
      [UIView animateWithDuration:0.25 animations:^{
        self.previewContainerView.layer.transform = transform;
      }];
    }

    // Restore chat scroll view bottom constraint
    if (self.isChatMode && self.chatScrollViewBottomConstraint) {
      self.chatScrollViewBottomConstraint.constant = -baseBottomBarHeight;
      [UIView animateWithDuration:0.2 animations:^{
        [self.chatScrollView.superview layoutIfNeeded];
      }];
    }

    [UIView animateWithDuration:0.2 animations:^{
      [self.bottomBarView layoutIfNeeded];
    }];
    return;
  }

  // Create container and add to contentView (INSIDE bottom bar, same as images)
  self.videoPreviewContainer = [[UIView alloc] init];
  self.videoPreviewContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.videoPreviewContainer.backgroundColor = [UIColor clearColor];
  self.videoPreviewContainer.userInteractionEnabled = YES;
  [contentView addSubview:self.videoPreviewContainer];
  [contentView sendSubviewToBack:self.videoPreviewContainer];

  // Ensure preview stays behind bottom bar
  if (self.previewContainerView) {
    self.previewContainerView.layer.zPosition = -100;
  }

  // Position at TOP of contentView (SAME as image preview)
  [NSLayoutConstraint activateConstraints:@[
    [self.videoPreviewContainer.topAnchor constraintEqualToAnchor:contentView.topAnchor constant:12],
    [self.videoPreviewContainer.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor constant:16],
    [self.videoPreviewContainer.trailingAnchor constraintEqualToAnchor:contentView.trailingAnchor constant:-16],
    [self.videoPreviewContainer.heightAnchor constraintEqualToConstant:60]
  ]];

  // Push inputContainer down to make room (SAME as image preview)
  for (NSLayoutConstraint *constraint in contentView.constraints) {
    if (constraint.firstItem == inputContainer && constraint.firstAttribute == NSLayoutAttributeTop) {
      constraint.constant = 76;
      break;
    }
  }

  // Push preview up when videos attached (SAME as image preview)
  if (self.previewContainerView && self.isZoomed && !self.isChatMode) {
    CATransform3D transform = CATransform3DIdentity;
    CGFloat scale = [self isIPad] ? 0.68 : 0.55;
    transform = CATransform3DScale(transform, scale, scale, 1.0);
    CGFloat translateY = [self isIPad] ? -160.0 : -92.0;
    transform = CATransform3DTranslate(transform, 0, translateY, 0);
    [UIView animateWithDuration:0.25 animations:^{
      self.previewContainerView.layer.transform = transform;
    }];
  }

  // Adjust chat scroll view bottom constraint when videos attached
  if (self.isChatMode && self.chatScrollViewBottomConstraint) {
    self.chatScrollViewBottomConstraint.constant = -(baseBottomBarHeight + 64);
    [UIView animateWithDuration:0.2 animations:^{
      [self.chatScrollView.superview layoutIfNeeded];
    }];
  }

  // Create horizontal scroll view (SAME as image preview)
  UIScrollView *scrollView = [[UIScrollView alloc] init];
  scrollView.translatesAutoresizingMaskIntoConstraints = NO;
  scrollView.showsHorizontalScrollIndicator = NO;
  scrollView.showsVerticalScrollIndicator = NO;
  [self.videoPreviewContainer addSubview:scrollView];

  [NSLayoutConstraint activateConstraints:@[
    [scrollView.topAnchor constraintEqualToAnchor:self.videoPreviewContainer.topAnchor],
    [scrollView.leadingAnchor constraintEqualToAnchor:self.videoPreviewContainer.leadingAnchor],
    [scrollView.trailingAnchor constraintEqualToAnchor:self.videoPreviewContainer.trailingAnchor],
    [scrollView.bottomAnchor constraintEqualToAnchor:self.videoPreviewContainer.bottomAnchor]
  ]];

  UIView *stackContainer = [[UIView alloc] init];
  stackContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [scrollView addSubview:stackContainer];

  [NSLayoutConstraint activateConstraints:@[
    [stackContainer.topAnchor constraintEqualToAnchor:scrollView.topAnchor],
    [stackContainer.leadingAnchor constraintEqualToAnchor:scrollView.leadingAnchor],
    [stackContainer.trailingAnchor constraintEqualToAnchor:scrollView.trailingAnchor],
    [stackContainer.bottomAnchor constraintEqualToAnchor:scrollView.bottomAnchor],
    [stackContainer.heightAnchor constraintEqualToAnchor:scrollView.heightAnchor]
  ]];

  UIView *previousView = nil;
  for (NSInteger i = 0; i < self.pendingVideoAttachments.count; i++) {
    // EXACT same wrapper as image cells - 60pt wide
    UIView *videoWrapper = [[UIView alloc] init];
    videoWrapper.translatesAutoresizingMaskIntoConstraints = NO;
    [stackContainer addSubview:videoWrapper];

    // Content background - 52x52 with 12pt corner radius (same as image cells)
    UIView *contentBackground = [[UIView alloc] init];
    contentBackground.translatesAutoresizingMaskIntoConstraints = NO;
    contentBackground.backgroundColor = [VideoPreviewAccentColor() colorWithAlphaComponent:0.25];
    contentBackground.layer.cornerRadius = 12;
    contentBackground.clipsToBounds = YES;
    [videoWrapper addSubview:contentBackground];

    // Centered video icon (replaces image)
    UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration configurationWithPointSize:24 weight:UIImageSymbolWeightMedium];
    UIImageView *videoIcon = [[UIImageView alloc] initWithImage:[UIImage systemImageNamed:@"film" withConfiguration:iconConfig]];
    videoIcon.translatesAutoresizingMaskIntoConstraints = NO;
    videoIcon.tintColor = VideoPreviewAccentColor();
    [contentBackground addSubview:videoIcon];

    // Remove badge - EXACT same as image cells (20x20 red circle, top-right)
    UIView *removeBadge = [[UIView alloc] init];
    removeBadge.translatesAutoresizingMaskIntoConstraints = NO;
    removeBadge.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    removeBadge.layer.cornerRadius = 10;
    removeBadge.clipsToBounds = YES;
    [videoWrapper addSubview:removeBadge];

    UIButton *removeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    removeButton.translatesAutoresizingMaskIntoConstraints = NO;
    removeButton.tag = i;
    removeButton.backgroundColor = [UIColor clearColor];

    UIImageSymbolConfiguration *xConfig = [UIImageSymbolConfiguration configurationWithPointSize:10 weight:UIImageSymbolWeightBold];
    UIImage *xImage = [UIImage systemImageNamed:@"xmark" withConfiguration:xConfig];
    [removeButton setImage:xImage forState:UIControlStateNormal];
    removeButton.tintColor = [UIColor whiteColor];
    [removeButton addTarget:self action:@selector(handleRemoveVideoTapped:) forControlEvents:UIControlEventTouchUpInside];
    [removeBadge addSubview:removeButton];

    // EXACT same constraints as image cells
    [NSLayoutConstraint activateConstraints:@[
      [videoWrapper.topAnchor constraintEqualToAnchor:stackContainer.topAnchor],
      [videoWrapper.bottomAnchor constraintEqualToAnchor:stackContainer.bottomAnchor],
      [videoWrapper.widthAnchor constraintEqualToConstant:60],

      [contentBackground.topAnchor constraintEqualToAnchor:videoWrapper.topAnchor constant:4],
      [contentBackground.leadingAnchor constraintEqualToAnchor:videoWrapper.leadingAnchor],
      [contentBackground.widthAnchor constraintEqualToConstant:52],
      [contentBackground.heightAnchor constraintEqualToConstant:52],

      [videoIcon.centerXAnchor constraintEqualToAnchor:contentBackground.centerXAnchor],
      [videoIcon.centerYAnchor constraintEqualToAnchor:contentBackground.centerYAnchor],

      [removeBadge.topAnchor constraintEqualToAnchor:videoWrapper.topAnchor],
      [removeBadge.trailingAnchor constraintEqualToAnchor:videoWrapper.trailingAnchor],
      [removeBadge.widthAnchor constraintEqualToConstant:20],
      [removeBadge.heightAnchor constraintEqualToConstant:20],

      [removeButton.topAnchor constraintEqualToAnchor:removeBadge.topAnchor],
      [removeButton.leadingAnchor constraintEqualToAnchor:removeBadge.leadingAnchor],
      [removeButton.trailingAnchor constraintEqualToAnchor:removeBadge.trailingAnchor],
      [removeButton.bottomAnchor constraintEqualToAnchor:removeBadge.bottomAnchor]
    ]];

    // EXACT same spacing as image cells - 8pt between items
    if (previousView) {
      [videoWrapper.leadingAnchor constraintEqualToAnchor:previousView.trailingAnchor constant:8].active = YES;
    } else {
      [videoWrapper.leadingAnchor constraintEqualToAnchor:stackContainer.leadingAnchor].active = YES;
    }

    previousView = videoWrapper;
  }

  if (previousView) {
    [previousView.trailingAnchor constraintEqualToAnchor:stackContainer.trailingAnchor].active = YES;
  }

  // Clear all button - EXACT same as image cells (only when > 1)
  if (self.pendingVideoAttachments.count > 1) {
    UIButton *clearAllButton = [UIButton buttonWithType:UIButtonTypeSystem];
    clearAllButton.translatesAutoresizingMaskIntoConstraints = NO;
    clearAllButton.backgroundColor = [UIColor colorWithWhite:0.2 alpha:0.8];
    clearAllButton.layer.cornerRadius = 12;
    clearAllButton.clipsToBounds = YES;
    [clearAllButton setTitle:@"Clear" forState:UIControlStateNormal];
    clearAllButton.titleLabel.font = [UIFont systemFontOfSize:11 weight:UIFontWeightMedium];
    [clearAllButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
    [clearAllButton addTarget:self action:@selector(handleClearAllVideosTapped:) forControlEvents:UIControlEventTouchUpInside];
    [self.videoPreviewContainer addSubview:clearAllButton];

    [NSLayoutConstraint activateConstraints:@[
      [clearAllButton.trailingAnchor constraintEqualToAnchor:self.videoPreviewContainer.trailingAnchor],
      [clearAllButton.centerYAnchor constraintEqualToAnchor:self.videoPreviewContainer.centerYAnchor],
      [clearAllButton.widthAnchor constraintEqualToConstant:50],
      [clearAllButton.heightAnchor constraintEqualToConstant:24]
    ]];
  }

  [UIView animateWithDuration:0.2 animations:^{
    [self.bottomBarView layoutIfNeeded];
  }];
}

- (void)handleRemoveVideoTapped:(UIButton *)sender {
  [self removeVideoAttachment:sender.tag];
}

- (void)handleClearAllVideosTapped:(UIButton *)sender {
  [self clearAllVideoAttachments];
}

#pragma mark - Upload Loading Indicator

- (void)showUploadingIndicator {
  UIButton *sendButton = self.sendButton;
  if (!sendButton) {
    return;
  }

  // Disable send button
  sendButton.enabled = NO;
  sendButton.alpha = 0.5;

  // Create activity indicator
  UIActivityIndicatorView *spinner;
  if (@available(iOS 13.0, *)) {
    spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  } else {
    spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleWhite];
  }
  spinner.color = [UIColor whiteColor];
  spinner.tag = 9999; // Tag to find later
  spinner.translatesAutoresizingMaskIntoConstraints = NO;
  [sendButton addSubview:spinner];

  [NSLayoutConstraint activateConstraints:@[
    [spinner.centerXAnchor constraintEqualToAnchor:sendButton.centerXAnchor],
    [spinner.centerYAnchor constraintEqualToAnchor:sendButton.centerYAnchor]
  ]];

  [spinner startAnimating];

  // Hide the button image
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = [sendButton.configuration copy];
    if (config) {
      config.image = nil;
      sendButton.configuration = config;
    }
  }
}

- (void)hideUploadingIndicator {
  UIButton *sendButton = self.sendButton;
  if (!sendButton) {
    return;
  }

  // Re-enable send button
  sendButton.enabled = YES;
  sendButton.alpha = 1.0;

  // Remove activity indicator
  UIView *spinner = [sendButton viewWithTag:9999];
  if (spinner) {
    [spinner removeFromSuperview];
  }

  // Restore button image
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = [sendButton.configuration copy];
    if (config) {
      config.image = [UIImage systemImageNamed:@"paperplane.fill"
                            withConfiguration:[UIImageSymbolConfiguration
                                configurationWithPointSize:16
                                                    weight:UIImageSymbolWeightBold]];
      sendButton.configuration = config;
    }
  }
}

#pragma mark - Agent Stop Functionality

- (void)updateSendButtonForAgentState {
  // Debounce rapid updates to prevent flickering
  static NSTimeInterval lastUpdateTime = 0;
  NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
  if (now - lastUpdateTime < 0.15) {
    // Schedule a delayed update to ensure final state is applied
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self performSendButtonStateUpdate];
    });
    return;
  }
  lastUpdateTime = now;

  [self performSendButtonStateUpdate];
}

- (void)performSendButtonStateUpdate {
  UIButton *sendButton = self.sendButton;
  UITextView *inputTextView = self.inputTextView;

  if (!sendButton) {
    return;
  }

  if (self.isAgentRunning) {
    // Transform send button to stop button
    sendButton.hidden = NO; // Always show when agent is running

    if (@available(iOS 15.0, *)) {
      UIButtonConfiguration *config = [UIButtonConfiguration filledButtonConfiguration];
      config.image = [UIImage systemImageNamed:@"stop.fill"
                            withConfiguration:[UIImageSymbolConfiguration
                                configurationWithPointSize:14
                                                    weight:UIImageSymbolWeightBold]];
      config.baseBackgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
      config.baseForegroundColor = [UIColor whiteColor];
      config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
      sendButton.configuration = config;
    } else {
      UIImageSymbolConfiguration *stopConfig = [UIImageSymbolConfiguration
          configurationWithPointSize:14
                              weight:UIImageSymbolWeightBold];
      UIImage *stopImage = [UIImage systemImageNamed:@"stop.fill"
                                   withConfiguration:stopConfig];
      [sendButton setImage:stopImage forState:UIControlStateNormal];
      sendButton.backgroundColor = [UIColor colorWithRed:0.9 green:0.3 blue:0.3 alpha:1.0];
    }

    // Remove existing targets and add stop handler
    [sendButton removeTarget:self action:@selector(handleSendButtonTapped:) forControlEvents:UIControlEventTouchUpInside];
    [sendButton addTarget:self action:@selector(handleStopAgentTapped:) forControlEvents:UIControlEventTouchUpInside];

    // Keep text input enabled so user can type while agent is running
    // (sending will be blocked in handleSendButtonTapped)
    if (inputTextView) {
      inputTextView.editable = YES;
      inputTextView.alpha = 1.0;
    }

    // Update mic button position
    if (self.micToSendConstraint && self.micToContainerConstraint) {
      self.micToSendConstraint.active = YES;
      self.micToContainerConstraint.active = NO;
    }
  } else {
    // Restore send button to normal state
    NSString *currentText = @"";
    if (inputTextView.attributedText) {
      currentText = inputTextView.attributedText.string ?: @"";
    } else {
      currentText = inputTextView.text ?: @"";
    }
    BOOL hasText = currentText.length > 0 && ![currentText isEqualToString:@"Message"];

    sendButton.hidden = !hasText;

    if (@available(iOS 26.0, *)) {
      SEL prominentGlassSelector = NSSelectorFromString(@"prominentGlass");
      if ([UIButtonConfiguration respondsToSelector:prominentGlassSelector]) {
        NSMethodSignature *signature = [UIButtonConfiguration
            methodSignatureForSelector:prominentGlassSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:prominentGlassSelector];
        [invocation setTarget:[UIButtonConfiguration class]];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        UIButtonConfiguration *config = (__bridge id)tempResult;

        config.image =
            [UIImage systemImageNamed:@"paperplane.fill"
                    withConfiguration:
                        [UIImageSymbolConfiguration
                            configurationWithPointSize:16
                                                weight:UIImageSymbolWeightBold]];
        config.baseForegroundColor = [UIColor whiteColor];
        config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
        sendButton.configuration = config;
      } else {
        UIButtonConfiguration *config =
            [UIButtonConfiguration filledButtonConfiguration];
        config.image =
            [UIImage systemImageNamed:@"paperplane.fill"
                    withConfiguration:
                        [UIImageSymbolConfiguration
                            configurationWithPointSize:16
                                                weight:UIImageSymbolWeightBold]];
        config.baseBackgroundColor = [UIColor systemBlueColor];
        config.baseForegroundColor = [UIColor whiteColor];
        config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
        sendButton.configuration = config;
      }
    } else if (@available(iOS 15.0, *)) {
      UIButtonConfiguration *config =
          [UIButtonConfiguration filledButtonConfiguration];
      config.image =
          [UIImage systemImageNamed:@"paperplane.fill"
                  withConfiguration:
                      [UIImageSymbolConfiguration
                          configurationWithPointSize:16
                                              weight:UIImageSymbolWeightBold]];
      config.baseBackgroundColor = [UIColor systemBlueColor];
      config.baseForegroundColor = [UIColor whiteColor];
      config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
      sendButton.configuration = config;
    } else {
      UIImageSymbolConfiguration *sendConfig = [UIImageSymbolConfiguration
          configurationWithPointSize:16
                              weight:UIImageSymbolWeightBold];
      UIImage *sendImage = [UIImage systemImageNamed:@"paperplane.fill"
                                   withConfiguration:sendConfig];
      [sendButton setImage:sendImage forState:UIControlStateNormal];
      sendButton.backgroundColor = [UIColor systemBlueColor];
    }

    // Remove stop handler and add send handler back
    [sendButton removeTarget:self action:@selector(handleStopAgentTapped:) forControlEvents:UIControlEventTouchUpInside];
    [sendButton addTarget:self action:@selector(handleSendButtonTapped:) forControlEvents:UIControlEventTouchUpInside];

    // Re-enable text input
    if (inputTextView) {
      inputTextView.editable = YES;
      inputTextView.alpha = 1.0;
    }

    // Update mic button position based on text
    if (self.micToSendConstraint && self.micToContainerConstraint) {
      self.micToSendConstraint.active = hasText;
      self.micToContainerConstraint.active = !hasText;
    }
  }

  // PERFORMANCE: Mark for layout before animation
  [self.bottomBarView setNeedsLayout];

  // Use UIViewPropertyAnimator for smooth 60fps animations
  UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
      initWithDampingRatio:0.9];

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:0.25
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;
  [animator addAnimations:^{
    [weakSelf.bottomBarView layoutIfNeeded];
  }];

  [animator startAnimation];
}

- (void)handleStopAgentTapped:(UIButton *)sender {
  if (self.isStoppingAgent || !self.isAgentRunning) {
    return;
  }

  NSString *sandboxId = self.sandboxId;
  if (!sandboxId || sandboxId.length == 0) {
    NSLog(@"❌ [BottomBar] No sandbox ID available to stop agent");
    // Force reset even without sandbox ID - allows user to unstick the UI
    self.isAgentRunning = NO;
    [self updateSendButtonForAgentState];
    return;
  }

  self.isStoppingAgent = YES;

  // Show loading state on button
  UIButton *sendButton = self.sendButton;
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config = [sendButton.configuration copy];
    if (config) {
      config.showsActivityIndicator = YES;
      config.image = nil;
      sendButton.configuration = config;
    }
  }

  NSLog(@"🛑 [BottomBar] Stopping agent for sandbox: %@", sandboxId);

  __weak typeof(self) weakSelf = self;
  [[EXChatBackendService sharedInstance] stopAgentWithSessionId:sandboxId
                                                     completion:^(BOOL success, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      weakSelf.isStoppingAgent = NO;

      if (error) {
        NSLog(@"❌ [BottomBar] Failed to stop agent: %@", error);
        // IMPORTANT: Even on error, force reset the UI after a timeout or network error
        // This prevents the UI from being stuck in stop mode forever
        // The user can always try again or refresh the app
        NSLog(@"⚠️ [BottomBar] Force-resetting agent state due to stop failure");
        weakSelf.isAgentRunning = NO;
        [weakSelf updateSendButtonForAgentState];
        return;
      }

      NSLog(@"✅ [BottomBar] Agent stopped successfully");

      // The session status update from server should trigger isAgentRunning = NO
      // through the polling mechanism, but we can also set it directly
      weakSelf.isAgentRunning = NO;
      [weakSelf updateSendButtonForAgentState];
    });
  }];
}

#pragma mark - Voice Recording

- (void)handleMicButtonTapped:(UIButton *)sender {
  if (self.isRecording) {
    [self stopVoiceRecording];
  } else if (self.isTranscribing) {
    // Already transcribing, ignore tap
    return;
  } else {
    [self startVoiceRecording];
  }
}

- (void)startVoiceRecording {
  if (self.isRecording || self.isTranscribing) {
    return;
  }

  NSLog(@"🎤 [BottomBar] Starting voice recording");

  // Check microphone permission first
  AVAudioSession *audioSession = [AVAudioSession sharedInstance];
  AVAudioSessionRecordPermission permission = [audioSession recordPermission];

  if (permission == AVAudioSessionRecordPermissionDenied) {
    [self showMicrophonePermissionAlert];
    return;
  }

  if (permission == AVAudioSessionRecordPermissionUndetermined) {
    // Permission will be requested by EXAudioRecorderService
  }

  __weak typeof(self) weakSelf = self;

  // Start recording with metering callback
  [[EXAudioRecorderService sharedInstance]
      startRecordingWithMeteringCallback:^(float level) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf updateWaveformWithLevel:level];
        });
      }
      completion:^(NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (error) {
            NSLog(@"❌ [BottomBar] Recording failed to start: %@", error);
            if ([error.localizedDescription containsString:@"permission"]) {
              [weakSelf showMicrophonePermissionAlert];
            } else {
              [weakSelf showRecordingErrorAlert:error.localizedDescription];
            }
            return;
          }

          weakSelf.isRecording = YES;
          [weakSelf showRecordingUI];
        });
      }];
}

- (void)stopVoiceRecording {
  if (!self.isRecording) {
    return;
  }

  NSLog(@"🎤 [BottomBar] Stopping voice recording");

  self.isRecording = NO;

  // Stop duration timer
  [self.recordingDurationTimer invalidate];
  self.recordingDurationTimer = nil;

  // Show transcribing state
  self.isTranscribing = YES;
  [self showTranscribingUI];

  __weak typeof(self) weakSelf = self;

  // Stop recording and get audio file
  [[EXAudioRecorderService sharedInstance]
      stopRecordingWithCompletion:^(NSURL * _Nullable audioURL, NSError * _Nullable error) {
        if (error || !audioURL) {
          NSLog(@"❌ [BottomBar] Recording stop failed: %@", error);
          dispatch_async(dispatch_get_main_queue(), ^{
            weakSelf.isTranscribing = NO;
            [weakSelf hideRecordingUI];
            [weakSelf showRecordingErrorAlert:error.localizedDescription ?: @"Failed to save recording"];
          });
          return;
        }

        NSLog(@"✅ [BottomBar] Recording saved: %@", audioURL);

        // Transcribe the audio
        [[EXAssemblyAIService sharedInstance]
            transcribeAudioFile:audioURL
            completion:^(NSString * _Nullable transcribedText, NSError * _Nullable transcribeError) {
              dispatch_async(dispatch_get_main_queue(), ^{
                weakSelf.isTranscribing = NO;
                [weakSelf hideRecordingUI];

                if (transcribeError) {
                  NSLog(@"❌ [BottomBar] Transcription failed: %@", transcribeError);
                  NSString *message = transcribeError.localizedDescription;
                  if ([message containsString:@"No speech"]) {
                    [weakSelf showNoSpeechDetectedAlert];
                  } else {
                    [weakSelf showRecordingErrorAlert:message];
                  }
                  return;
                }

                if (transcribedText && transcribedText.length > 0) {
                  NSLog(@"✅ [BottomBar] Transcription: %@", transcribedText);
                  [weakSelf insertTranscribedText:transcribedText];
                } else {
                  [weakSelf showNoSpeechDetectedAlert];
                }

                // Clean up audio file
                [[NSFileManager defaultManager] removeItemAtURL:audioURL error:nil];
              });
            }];
      }];
}

- (void)cancelVoiceRecording {
  if (!self.isRecording && !self.isTranscribing) {
    return;
  }

  NSLog(@"🎤 [BottomBar] Cancelling voice recording");

  self.isRecording = NO;
  self.isTranscribing = NO;

  // Stop duration timer
  [self.recordingDurationTimer invalidate];
  self.recordingDurationTimer = nil;

  // Cancel recording
  [[EXAudioRecorderService sharedInstance] cancelRecording];

  // Cancel any ongoing transcription
  [[EXAssemblyAIService sharedInstance] cancelTranscription];

  // Hide recording UI
  [self hideRecordingUI];
}

#pragma mark - Recording UI

- (void)showRecordingUI {
  UITextView *inputTextView = self.inputTextView;
  UIView *inputContentView = inputTextView.superview;

  if (!inputContentView) {
    return;
  }

  // Hide the input text view
  inputTextView.hidden = YES;

  // Hide left side buttons during recording
  self.modelSelectorButton.hidden = YES;
  self.imageButton.hidden = YES;

  // Create recording container
  UIView *recordingContainer = [[UIView alloc] init];
  recordingContainer.translatesAutoresizingMaskIntoConstraints = NO;
  recordingContainer.backgroundColor = [UIColor clearColor];
  [inputContentView addSubview:recordingContainer];
  self.recordingContainerView = recordingContainer;

  // Create waveform view
  EXAudioWaveformView *waveformView = [[EXAudioWaveformView alloc] init];
  waveformView.translatesAutoresizingMaskIntoConstraints = NO;
  waveformView.barColor = [UIColor whiteColor];
  waveformView.numberOfBars = 20;
  waveformView.barWidth = 3.0;
  waveformView.barSpacing = 3.0;
  waveformView.minimumBarHeightRatio = 0.15;
  [recordingContainer addSubview:waveformView];

  // Create recording time label
  UILabel *timeLabel = [[UILabel alloc] init];
  timeLabel.translatesAutoresizingMaskIntoConstraints = NO;
  timeLabel.text = @"0:00";
  timeLabel.textColor = [UIColor whiteColor];
  timeLabel.font = [UIFont monospacedDigitSystemFontOfSize:14 weight:UIFontWeightMedium];
  timeLabel.textAlignment = NSTextAlignmentRight;
  [recordingContainer addSubview:timeLabel];
  self.recordingTimeLabel = timeLabel;

  // Layout constraints
  [NSLayoutConstraint activateConstraints:@[
    // Recording container fills input area
    [recordingContainer.leadingAnchor constraintEqualToAnchor:inputContentView.leadingAnchor constant:12],
    [recordingContainer.trailingAnchor constraintEqualToAnchor:self.micButton.leadingAnchor constant:-12],
    [recordingContainer.topAnchor constraintEqualToAnchor:inputContentView.topAnchor],
    [recordingContainer.bottomAnchor constraintEqualToAnchor:inputContentView.bottomAnchor],

    // Waveform view
    [waveformView.leadingAnchor constraintEqualToAnchor:recordingContainer.leadingAnchor],
    [waveformView.trailingAnchor constraintEqualToAnchor:timeLabel.leadingAnchor constant:-12],
    [waveformView.topAnchor constraintEqualToAnchor:recordingContainer.topAnchor constant:8],
    [waveformView.bottomAnchor constraintEqualToAnchor:recordingContainer.bottomAnchor constant:-8],

    // Time label
    [timeLabel.trailingAnchor constraintEqualToAnchor:recordingContainer.trailingAnchor],
    [timeLabel.centerYAnchor constraintEqualToAnchor:recordingContainer.centerYAnchor],
    [timeLabel.widthAnchor constraintEqualToConstant:50]
  ]];

  // Start waveform animation
  [waveformView startAnimating];

  // Start duration timer
  self.recordingStartTime = [[NSDate date] timeIntervalSince1970];
  self.recordingDurationTimer = [NSTimer scheduledTimerWithTimeInterval:0.1
                                                                 target:self
                                                               selector:@selector(updateRecordingDuration)
                                                               userInfo:nil
                                                                repeats:YES];

  // Update mic button to stop icon
  [self updateMicButtonToStopIcon:YES];

  // Animate in
  recordingContainer.alpha = 0;
  [UIView animateWithDuration:0.2 animations:^{
    recordingContainer.alpha = 1;
  }];
}

- (void)showTranscribingUI {
  // Update time label to show "Transcribing..."
  if (self.recordingTimeLabel) {
    self.recordingTimeLabel.text = @"...";
  }

  // Stop waveform animation
  if (self.recordingContainerView) {
    for (UIView *subview in self.recordingContainerView.subviews) {
      if ([subview isKindOfClass:[EXAudioWaveformView class]]) {
        EXAudioWaveformView *waveform = (EXAudioWaveformView *)subview;
        [waveform stopAnimating];
        [waveform reset];
      }
    }
  }

  // Add activity indicator
  UIActivityIndicatorView *spinner;
  if (@available(iOS 13.0, *)) {
    spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  } else {
    spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleWhite];
  }
  spinner.color = [UIColor whiteColor];
  spinner.translatesAutoresizingMaskIntoConstraints = NO;
  spinner.tag = 8888; // Tag for removal
  [self.recordingContainerView addSubview:spinner];

  [NSLayoutConstraint activateConstraints:@[
    [spinner.centerXAnchor constraintEqualToAnchor:self.recordingContainerView.centerXAnchor],
    [spinner.centerYAnchor constraintEqualToAnchor:self.recordingContainerView.centerYAnchor]
  ]];

  [spinner startAnimating];

  // Disable mic button during transcription
  self.micButton.enabled = NO;
  self.micButton.alpha = 0.5;
}

- (void)hideRecordingUI {
  // Remove recording container immediately (not animated to ensure cleanup)
  if (self.recordingContainerView) {
    // Stop waveform animation first
    for (UIView *subview in self.recordingContainerView.subviews) {
      if ([subview isKindOfClass:[EXAudioWaveformView class]]) {
        [(EXAudioWaveformView *)subview stopAnimating];
      }
    }

    // Remove immediately without animation to ensure cleanup
    [self.recordingContainerView removeFromSuperview];
    self.recordingContainerView = nil;
  }

  self.recordingTimeLabel = nil;

  // Show input text view
  self.inputTextView.hidden = NO;

  // Update button visibility based on keyboard state
  [self updateBottomBarForKeyboardVisible:self.isKeyboardVisible];

  // Restore mic button
  [self updateMicButtonToStopIcon:NO];
  self.micButton.enabled = YES;
  self.micButton.alpha = 1.0;

  // Force layout update
  [self.bottomBarView setNeedsLayout];
  [self.bottomBarView layoutIfNeeded];
}

- (void)updateWaveformWithLevel:(float)level {
  if (!self.recordingContainerView) {
    return;
  }

  for (UIView *subview in self.recordingContainerView.subviews) {
    if ([subview isKindOfClass:[EXAudioWaveformView class]]) {
      [(EXAudioWaveformView *)subview updateWithLevel:level];
      break;
    }
  }
}

- (void)updateRecordingDuration {
  NSTimeInterval duration = [[NSDate date] timeIntervalSince1970] - self.recordingStartTime;
  NSInteger minutes = (NSInteger)(duration / 60);
  NSInteger seconds = (NSInteger)duration % 60;

  self.recordingTimeLabel.text = [NSString stringWithFormat:@"%ld:%02ld", (long)minutes, (long)seconds];
}

- (void)updateMicButtonToStopIcon:(BOOL)isStop {
  UIButton *micButton = self.micButton;
  if (!micButton) {
    return;
  }

  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config;

    if (isStop) {
      config = [UIButtonConfiguration filledButtonConfiguration];
      config.image = [UIImage systemImageNamed:@"stop.fill"
                             withConfiguration:[UIImageSymbolConfiguration
                                                configurationWithPointSize:14
                                                weight:UIImageSymbolWeightBold]];
      config.baseBackgroundColor = [UIColor colorWithRed:0.9 green:0.2 blue:0.2 alpha:1.0];
      config.baseForegroundColor = [UIColor whiteColor];
      config.cornerStyle = UIButtonConfigurationCornerStyleCapsule;
    } else {
      config = [UIButtonConfiguration plainButtonConfiguration];
      config.image = [UIImage systemImageNamed:@"mic.fill"
                             withConfiguration:[UIImageSymbolConfiguration
                                                configurationWithPointSize:16
                                                weight:UIImageSymbolWeightMedium]];
      config.baseForegroundColor = [UIColor colorWithWhite:0.8 alpha:1.0];
    }

    micButton.configuration = config;
  } else {
    // Fallback for iOS < 15
    if (isStop) {
      UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration
          configurationWithPointSize:14
                              weight:UIImageSymbolWeightBold];
      UIImage *stopImage = [UIImage systemImageNamed:@"stop.fill" withConfiguration:config];
      [micButton setImage:stopImage forState:UIControlStateNormal];
      micButton.tintColor = [UIColor whiteColor];
      micButton.backgroundColor = [UIColor colorWithRed:0.9 green:0.2 blue:0.2 alpha:1.0];
      micButton.layer.cornerRadius = 16;
    } else {
      UIImageSymbolConfiguration *config = [UIImageSymbolConfiguration
          configurationWithPointSize:16
                              weight:UIImageSymbolWeightMedium];
      UIImage *micImage = [UIImage systemImageNamed:@"mic.fill" withConfiguration:config];
      [micButton setImage:micImage forState:UIControlStateNormal];
      micButton.tintColor = [UIColor colorWithWhite:0.8 alpha:1.0];
      micButton.backgroundColor = [UIColor clearColor];
    }
  }
}

- (void)insertTranscribedText:(NSString *)text {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView || !text || text.length == 0) {
    return;
  }

  // Get current text (excluding placeholder)
  NSString *currentText = inputTextView.text;
  BOOL isPlaceholder = [currentText isEqualToString:@"Message"];

  if (isPlaceholder) {
    // Replace placeholder with transcribed text
    inputTextView.text = text;
    inputTextView.textColor = [UIColor whiteColor];
  } else {
    // Append to existing text with space
    if (currentText.length > 0 && ![currentText hasSuffix:@" "]) {
      inputTextView.text = [NSString stringWithFormat:@"%@ %@", currentText, text];
    } else {
      inputTextView.text = [NSString stringWithFormat:@"%@%@", currentText, text];
    }
  }

  // Trigger text change notification to update UI
  [[NSNotificationCenter defaultCenter]
      postNotificationName:UITextViewTextDidChangeNotification
                    object:inputTextView];
}

#pragma mark - Alerts

- (void)showMicrophonePermissionAlert {
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"Microphone Access"
                       message:@"Please enable microphone access in Settings to use voice input."
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"Cancel"
                                            style:UIAlertActionStyleCancel
                                          handler:nil]];

  [alert addAction:[UIAlertAction actionWithTitle:@"Settings"
                                            style:UIAlertActionStyleDefault
                                          handler:^(UIAlertAction * _Nonnull action) {
    NSURL *settingsURL = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
    if ([[UIApplication sharedApplication] canOpenURL:settingsURL]) {
      [[UIApplication sharedApplication] openURL:settingsURL options:@{} completionHandler:nil];
    }
  }]];

  [self presentAlert:alert];
}

- (void)showRecordingErrorAlert:(NSString *)message {
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"Recording Error"
                       message:message ?: @"An error occurred while recording."
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                            style:UIAlertActionStyleDefault
                                          handler:nil]];

  [self presentAlert:alert];
}

- (void)showNoSpeechDetectedAlert {
  UIAlertController *alert = [UIAlertController
      alertControllerWithTitle:@"No Speech Detected"
                       message:@"Please try speaking louder or closer to the microphone."
                preferredStyle:UIAlertControllerStyleAlert];

  [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                            style:UIAlertActionStyleDefault
                                          handler:nil]];

  [self presentAlert:alert];
}

- (void)presentAlert:(UIAlertController *)alert {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  UIViewController *rootVC = window.rootViewController;
  while (rootVC.presentedViewController) {
    rootVC = rootVC.presentedViewController;
  }
  [rootVC presentViewController:alert animated:YES completion:nil];
}

#pragma mark - Model Selector

- (void)updateModelSelectorMenu {
  UIButton *button = self.modelSelectorButton;
  if (!button) return;

  if (@available(iOS 14.0, *)) {
    NSString *selectedModel = [[NSUserDefaults standardUserDefaults]
        stringForKey:@"SelectedClaudeModel"] ?: @"claude-opus-4-5-20251101";

    __weak typeof(self) weakSelf = self;

    // Create Claude icon for menu items
    UIColor *claudeColor = [UIColor colorWithRed:0.85 green:0.467 blue:0.341 alpha:1.0]; // #D97757
    UIImage *menuClaudeIcon = createClaudeIconImage(18, claudeColor);

    UIAction *opusAction = [UIAction
        actionWithTitle:@"Claude Opus 4.5"
                  image:menuClaudeIcon
             identifier:@"claude-opus-4-5-20251101"
                handler:^(__kindof UIAction *_Nonnull action) {
                  [[NSUserDefaults standardUserDefaults]
                      setObject:@"claude-opus-4-5-20251101"
                         forKey:@"SelectedClaudeModel"];
                  [[NSUserDefaults standardUserDefaults] synchronize];
                  [weakSelf updateModelSelectorMenu];
                }];
    opusAction.state = [selectedModel isEqualToString:@"claude-opus-4-5-20251101"]
        ? UIMenuElementStateOn : UIMenuElementStateOff;

    UIAction *sonnetAction = [UIAction
        actionWithTitle:@"Claude Sonnet 4.5"
                  image:menuClaudeIcon
             identifier:@"claude-sonnet-4-5"
                handler:^(__kindof UIAction *_Nonnull action) {
                  [[NSUserDefaults standardUserDefaults]
                      setObject:@"claude-sonnet-4-5"
                         forKey:@"SelectedClaudeModel"];
                  [[NSUserDefaults standardUserDefaults] synchronize];
                  [weakSelf updateModelSelectorMenu];
                }];
    sonnetAction.state = [selectedModel isEqualToString:@"claude-sonnet-4-5"]
        ? UIMenuElementStateOn : UIMenuElementStateOff;

    UIAction *haikuAction = [UIAction
        actionWithTitle:@"Claude Haiku 4.5"
                  image:menuClaudeIcon
             identifier:@"claude-haiku-4-5"
                handler:^(__kindof UIAction *_Nonnull action) {
                  [[NSUserDefaults standardUserDefaults]
                      setObject:@"claude-haiku-4-5"
                         forKey:@"SelectedClaudeModel"];
                  [[NSUserDefaults standardUserDefaults] synchronize];
                  [weakSelf updateModelSelectorMenu];
                }];
    haikuAction.state = [selectedModel isEqualToString:@"claude-haiku-4-5"]
        ? UIMenuElementStateOn : UIMenuElementStateOff;

    UIMenu *modelMenu = [UIMenu
        menuWithTitle:@"Select Model"
             children:@[opusAction, sonnetAction, haikuAction]];

    button.menu = modelMenu;

    NSLog(@"🧠 [BottomBar] Model selector updated: %@", selectedModel);
  }
}

- (void)appendToInput:(NSString *)text {
  if (!self.inputTextView) {
    return;
  }

  NSString *currentText = self.inputTextView.text ?: @"";

  // If placeholder text, clear it first
  if ([currentText isEqualToString:@"Message"]) {
    currentText = @"";
    self.inputTextView.textColor = [UIColor whiteColor];
  }

  // Append the new text
  NSString *newText = [currentText stringByAppendingString:text];
  self.inputTextView.text = newText;

  // Trigger any text change handlers
  [[NSNotificationCenter defaultCenter] postNotificationName:UITextViewTextDidChangeNotification object:self.inputTextView];

  NSLog(@"📝 [BottomBar] Appended to input: %@", text);
}

@end
