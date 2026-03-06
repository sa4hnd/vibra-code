// Copyright 2015-present 650 Industries. All rights reserved.

#import <AsyncDisplayKit/AsyncDisplayKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * EXChatTaskCardNode - Texture-based async node for task cards
 *
 * Renders todo lists with:
 * - Liquid Glass effect on iOS 26+ with blur fallback
 * - "TASKS" header with count and status dot
 * - Individual task items with checkmarks/progress/spinner
 * - Shimmer effect on active tasks when isLatest
 *
 * Matches NewOnboardingScreen15 TaskCard component exactly.
 */
@interface EXChatTaskCardNode : ASCellNode

/// Initialize with todos array
/// @param todos Array of todo dictionaries with id, content, status
/// @param isLatest Whether this is the latest task card (shows shimmer on active tasks)
/// @param width Container width for layout calculations
- (instancetype)initWithTodos:(NSArray<NSDictionary *> *)todos
                     isLatest:(BOOL)isLatest
                        width:(CGFloat)width;

@end

NS_ASSUME_NONNULL_END
