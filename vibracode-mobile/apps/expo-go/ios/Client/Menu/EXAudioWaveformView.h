// Copyright 2015-present 650 Industries. All rights reserved.

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Animated vertical bar waveform visualization.
 * Displays audio levels as bouncing vertical bars (like Voice Memos).
 */
@interface EXAudioWaveformView : UIView

/**
 * Color of the waveform bars. Default is white.
 */
@property (nonatomic, strong) UIColor *barColor;

/**
 * Number of bars to display. Default is 20.
 */
@property (nonatomic, assign) NSInteger numberOfBars;

/**
 * Minimum bar height as fraction of view height. Default is 0.1.
 */
@property (nonatomic, assign) CGFloat minimumBarHeightRatio;

/**
 * Bar width. Default is 3.0.
 */
@property (nonatomic, assign) CGFloat barWidth;

/**
 * Bar corner radius. Default is 1.5.
 */
@property (nonatomic, assign) CGFloat barCornerRadius;

/**
 * Bar spacing. Default is 3.0.
 */
@property (nonatomic, assign) CGFloat barSpacing;

/**
 * Update the waveform with a new audio level.
 * @param level Normalized audio level (0.0 - 1.0)
 */
- (void)updateWithLevel:(float)level;

/**
 * Start the waveform animation.
 */
- (void)startAnimating;

/**
 * Stop the waveform animation.
 */
- (void)stopAnimating;

/**
 * Reset all levels to minimum.
 */
- (void)reset;

@end

NS_ASSUME_NONNULL_END
