// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXAudioWaveformView.h"

@interface EXAudioWaveformView ()

@property (nonatomic, strong) NSMutableArray<NSNumber *> *audioLevels;
@property (nonatomic, strong) NSMutableArray<CAShapeLayer *> *barLayers;
@property (nonatomic, strong) CADisplayLink *displayLink;
@property (nonatomic, assign) float targetLevel;
@property (nonatomic, assign) float currentLevel;
@property (nonatomic, assign) BOOL isAnimating;

@end

@implementation EXAudioWaveformView

#pragma mark - Initialization

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    [self commonInit];
  }
  return self;
}

- (instancetype)initWithCoder:(NSCoder *)coder {
  self = [super initWithCoder:coder];
  if (self) {
    [self commonInit];
  }
  return self;
}

- (void)commonInit {
  // Default values
  _barColor = [UIColor whiteColor];
  _numberOfBars = 20;
  _minimumBarHeightRatio = 0.15;
  _barWidth = 3.0;
  _barCornerRadius = 1.5;
  _barSpacing = 3.0;
  _targetLevel = 0.0;
  _currentLevel = 0.0;
  _isAnimating = NO;

  // Initialize arrays
  _audioLevels = [NSMutableArray array];
  _barLayers = [NSMutableArray array];

  // Initialize audio levels with minimum values
  for (NSInteger i = 0; i < _numberOfBars; i++) {
    [_audioLevels addObject:@(_minimumBarHeightRatio)];
  }

  // Set up view
  self.backgroundColor = [UIColor clearColor];
  self.clipsToBounds = NO;

  // Create bar layers
  [self createBarLayers];
}

- (void)dealloc {
  [self stopAnimating];
}

#pragma mark - Layout

- (void)layoutSubviews {
  [super layoutSubviews];
  [self updateBarLayerFrames];
}

- (void)createBarLayers {
  // Remove existing layers
  for (CAShapeLayer *layer in self.barLayers) {
    [layer removeFromSuperlayer];
  }
  [self.barLayers removeAllObjects];

  // Create new layers
  for (NSInteger i = 0; i < self.numberOfBars; i++) {
    CAShapeLayer *barLayer = [CAShapeLayer layer];
    barLayer.fillColor = self.barColor.CGColor;
    [self.layer addSublayer:barLayer];
    [self.barLayers addObject:barLayer];
  }

  [self updateBarLayerFrames];
}

- (void)updateBarLayerFrames {
  if (self.barLayers.count == 0 || CGRectIsEmpty(self.bounds)) {
    return;
  }

  CGFloat viewWidth = CGRectGetWidth(self.bounds);
  CGFloat viewHeight = CGRectGetHeight(self.bounds);

  // Calculate total width needed
  CGFloat totalBarsWidth = (self.barWidth * self.numberOfBars) + (self.barSpacing * (self.numberOfBars - 1));

  // Center the bars horizontally
  CGFloat startX = (viewWidth - totalBarsWidth) / 2.0;

  for (NSInteger i = 0; i < self.barLayers.count; i++) {
    CAShapeLayer *barLayer = self.barLayers[i];
    CGFloat level = (i < self.audioLevels.count) ? [self.audioLevels[i] floatValue] : self.minimumBarHeightRatio;

    CGFloat barHeight = viewHeight * level;
    CGFloat barX = startX + (i * (self.barWidth + self.barSpacing));
    CGFloat barY = (viewHeight - barHeight) / 2.0; // Center vertically

    CGRect barRect = CGRectMake(barX, barY, self.barWidth, barHeight);
    UIBezierPath *barPath = [UIBezierPath bezierPathWithRoundedRect:barRect cornerRadius:self.barCornerRadius];
    barLayer.path = barPath.CGPath;
  }
}

#pragma mark - Public Methods

- (void)updateWithLevel:(float)level {
  self.targetLevel = MAX(self.minimumBarHeightRatio, MIN(1.0, level));
}

- (void)startAnimating {
  if (self.isAnimating) {
    return;
  }

  self.isAnimating = YES;
  self.displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(updateAnimation)];
  self.displayLink.preferredFramesPerSecond = 60;
  [self.displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
}

- (void)stopAnimating {
  if (!self.isAnimating) {
    return;
  }

  self.isAnimating = NO;
  [self.displayLink invalidate];
  self.displayLink = nil;
}

- (void)reset {
  self.targetLevel = self.minimumBarHeightRatio;
  self.currentLevel = self.minimumBarHeightRatio;

  for (NSInteger i = 0; i < self.audioLevels.count; i++) {
    self.audioLevels[i] = @(self.minimumBarHeightRatio);
  }

  [self updateBarLayerFrames];
}

#pragma mark - Animation

- (void)updateAnimation {
  // Smooth interpolation towards target level
  CGFloat smoothingFactor = 0.3;
  self.currentLevel = self.currentLevel + (self.targetLevel - self.currentLevel) * smoothingFactor;

  // Shift levels to the right and add new level at the start
  // This creates a "flowing" effect
  for (NSInteger i = self.audioLevels.count - 1; i > 0; i--) {
    self.audioLevels[i] = self.audioLevels[i - 1];
  }

  // Add some variation for more organic look
  CGFloat variation = ((float)arc4random() / UINT32_MAX) * 0.1 - 0.05;
  CGFloat newLevel = self.currentLevel + variation;
  newLevel = MAX(self.minimumBarHeightRatio, MIN(1.0, newLevel));
  self.audioLevels[0] = @(newLevel);

  // Update bar frames
  [self updateBarLayerFrames];
}

#pragma mark - Setters

- (void)setBarColor:(UIColor *)barColor {
  _barColor = barColor;
  for (CAShapeLayer *layer in self.barLayers) {
    layer.fillColor = barColor.CGColor;
  }
}

- (void)setNumberOfBars:(NSInteger)numberOfBars {
  if (_numberOfBars == numberOfBars) {
    return;
  }

  _numberOfBars = numberOfBars;

  // Resize audio levels array
  while (self.audioLevels.count < numberOfBars) {
    [self.audioLevels addObject:@(self.minimumBarHeightRatio)];
  }
  while (self.audioLevels.count > numberOfBars) {
    [self.audioLevels removeLastObject];
  }

  // Recreate bar layers
  [self createBarLayers];
}

@end
