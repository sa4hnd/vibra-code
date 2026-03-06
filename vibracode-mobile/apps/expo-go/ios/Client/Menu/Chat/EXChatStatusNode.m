// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXChatStatusNode.h"
#import "Expo_Go-Swift.h"

// Status dot pulse animation layer name
static NSString *const kPulseAnimationKey = @"pulseAnimation";

@interface EXChatStatusNode ()

@property (nonatomic, strong) ASDisplayNode *statusDotNode;
@property (nonatomic, strong) ASTextNode *statusTextNode;
@property (nonatomic, assign) BOOL isWorking;
@property (nonatomic, assign) BOOL isReady;
@property (nonatomic, assign) CGFloat containerWidth;
@property (nonatomic, assign) BOOL shimmerApplied;

@end

@implementation EXChatStatusNode

- (instancetype)initWithStatusMessage:(nullable NSString *)statusMessage
                            isWorking:(BOOL)isWorking
                                width:(CGFloat)width {
  self = [super init];
  if (self) {
    self.automaticallyManagesSubnodes = YES;
    self.backgroundColor = [UIColor clearColor];

    _isWorking = isWorking;
    _isReady = !isWorking;
    _containerWidth = width;
    _shimmerApplied = NO;
    NSString *displayMessage = statusMessage ?: @"Working";

    // Truncate if too long (match React Native behavior)
    if (displayMessage.length > 40) {
      displayMessage = [[displayMessage substringToIndex:40] stringByAppendingString:@"..."];
    }

    // Status dot node - pulsing white/green dot
    __weak typeof(self) weakSelf = self;
    _statusDotNode = [[ASDisplayNode alloc] initWithViewBlock:^UIView * _Nonnull{
      UIView *dotView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 10, 10)];
      dotView.layer.cornerRadius = 5;

      if (weakSelf.isReady) {
        // Green dot for ready state
        dotView.backgroundColor = [UIColor colorWithRed:0.2 green:0.78 blue:0.35 alpha:1.0]; // #34C759
        dotView.layer.shadowColor = [UIColor colorWithRed:0.2 green:0.78 blue:0.35 alpha:1.0].CGColor;
        dotView.layer.shadowOpacity = 0.7;
        dotView.layer.shadowRadius = 4;
        dotView.layer.shadowOffset = CGSizeZero;
      } else {
        // White pulsing dot for working state
        dotView.backgroundColor = [UIColor whiteColor];
        dotView.layer.shadowColor = [UIColor whiteColor].CGColor;
        dotView.layer.shadowOpacity = 0.5;
        dotView.layer.shadowRadius = 6;
        dotView.layer.shadowOffset = CGSizeZero;

        // Add pulse animation
        [weakSelf addPulseAnimationToLayer:dotView.layer];
      }

      return dotView;
    }];

    // Status text node
    _statusTextNode = [[ASTextNode alloc] init];
    _statusTextNode.maximumNumberOfLines = 1;

    UIColor *textColor;
    if (_isReady) {
      textColor = [UIColor colorWithRed:0.2 green:0.78 blue:0.35 alpha:1.0]; // Green for ready
    } else {
      textColor = [UIColor colorWithWhite:1.0 alpha:0.7]; // White 70% for working
    }

    _statusTextNode.attributedText = [[NSAttributedString alloc]
                                      initWithString:displayMessage
                                      attributes:@{
      NSFontAttributeName: [UIFont systemFontOfSize:15],
      NSForegroundColorAttributeName: textColor
    }];

    // Apply text shimmer for working state (after view loads)
    if (isWorking) {
      _statusTextNode.layerBacked = NO; // Need view for shimmer
    }
  }
  return self;
}

- (void)addPulseAnimationToLayer:(CALayer *)layer {
  CABasicAnimation *pulseAnimation = [CABasicAnimation animationWithKeyPath:@"transform.scale"];
  pulseAnimation.duration = 0.8;
  pulseAnimation.fromValue = @1.0;
  pulseAnimation.toValue = @1.4;
  pulseAnimation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
  pulseAnimation.autoreverses = YES;
  pulseAnimation.repeatCount = HUGE_VALF;

  [layer addAnimation:pulseAnimation forKey:kPulseAnimationKey];
}

- (void)didEnterVisibleState {
  [super didEnterVisibleState];

  // Animate status appearance with spring animation for smooth scrolling
  // HIG: Uses spring animation matching other chat elements
  if (self.view) {
    [EXCellAnimationHelper prepareForAppearAnimation:self.view style:EXCellAnimationStyleSpringIn];
    [EXCellAnimationHelper animateAppearance:self.view style:EXCellAnimationStyleSpringIn delay:0 completion:nil];
  }

  // Apply text shimmer when node becomes visible (view is available)
  if (self.isWorking && !self.shimmerApplied && self.statusTextNode.view) {
    [EXTextShimmerHelper applyShimmerToTextNode:self.statusTextNode.view duration:1.5];
    self.shimmerApplied = YES;
  }
}

- (void)didExitVisibleState {
  [super didExitVisibleState];

  // Remove shimmer when node exits visible state
  if (self.shimmerApplied && self.statusTextNode.view) {
    [EXTextShimmerHelper removeShimmerFromTextNode:self.statusTextNode.view];
    self.shimmerApplied = NO;
  }
}

- (void)dealloc {
  // Remove shimmer and pulse animations
  if (self.statusTextNode.view) {
    [EXTextShimmerHelper removeShimmerFromTextNode:self.statusTextNode.view];
  }
  if (self.statusDotNode.view) {
    [self.statusDotNode.view.layer removeAnimationForKey:kPulseAnimationKey];
  }
}

#pragma mark - ASDisplayNode Layout

- (ASLayoutSpec *)layoutSpecThatFits:(ASSizeRange)constrainedSize {
  // Return zero-height layout when not working to prevent layout shifts
  // The cell stays in the collection view but renders as invisible/zero-height
  if (!self.isWorking) {
    ASLayoutSpec *emptySpec = [[ASLayoutSpec alloc] init];
    emptySpec.style.preferredSize = CGSizeMake(constrainedSize.max.width, 0);
    return emptySpec;
  }

  // Status dot sizing
  self.statusDotNode.style.preferredSize = CGSizeMake(10, 10);

  // Horizontal stack: dot + text (matching NewOnboardingScreen15 StatusMessage)
  ASStackLayoutSpec *horizontalStack = [ASStackLayoutSpec
                                        stackLayoutSpecWithDirection:ASStackLayoutDirectionHorizontal
                                        spacing:12
                                        justifyContent:ASStackLayoutJustifyContentStart
                                        alignItems:ASStackLayoutAlignItemsCenter
                                        children:@[self.statusDotNode, self.statusTextNode]];

  // Inset for padding: match chat message bubble margins (16pt horizontal)
  // HIG: Consistent spacing throughout the list creates visual harmony
  UIEdgeInsets insets = UIEdgeInsetsMake(12, 16, 12, 16);
  return [ASInsetLayoutSpec insetLayoutSpecWithInsets:insets child:horizontalStack];
}

@end
