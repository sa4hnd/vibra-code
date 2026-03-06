// Copyright 2015-present 650 Industries. All rights reserved.

#import <AsyncDisplayKit/AsyncDisplayKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * EXChatStatusNode - Texture-based async node for status messages
 *
 * Features:
 * - Lottie animation for pulsing dot
 * - Async text layout
 * - Shimmer effect for "working" state
 */
@interface EXChatStatusNode : ASCellNode

/// Initialize with status message
/// @param statusMessage The status text to display (e.g., "Working", "Reading file...")
/// @param isWorking Whether the status indicator should animate
/// @param width Container width for layout
- (instancetype)initWithStatusMessage:(nullable NSString *)statusMessage
                            isWorking:(BOOL)isWorking
                                width:(CGFloat)width;

@end

NS_ASSUME_NONNULL_END
