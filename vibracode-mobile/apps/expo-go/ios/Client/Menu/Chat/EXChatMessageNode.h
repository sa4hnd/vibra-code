// Copyright 2015-present 650 Industries. All rights reserved.

#import <AsyncDisplayKit/AsyncDisplayKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * EXChatMessageNode - Texture-based async node for chat messages
 *
 * Uses ASDisplayKit (Texture) for off-main-thread text layout and rendering:
 * - ASTextNode for async text measurement and rendering
 * - Background layout calculations
 * - Automatic memory management for large lists
 */
@interface EXChatMessageNode : ASCellNode

/// Initialize with message data
/// @param data Message dictionary containing content, role, imageUrl, etc.
/// @param isLatest Whether this is the latest message (shows shimmer effect for assistant)
/// @param width The container width for layout calculations
- (instancetype)initWithData:(NSDictionary *)data
                    isLatest:(BOOL)isLatest
                       width:(CGFloat)width;

@end

NS_ASSUME_NONNULL_END
