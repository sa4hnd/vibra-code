// Copyright 2015-present 650 Industries. All rights reserved.

#import <AsyncDisplayKit/AsyncDisplayKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, EXChatGroupType) {
  EXChatGroupTypeRead,      // Blue - Read files
  EXChatGroupTypeEdit,      // Purple - Edit files
  EXChatGroupTypeBash,      // Green - Bash commands
  EXChatGroupTypeDefault    // White - Default
};

/**
 * EXChatGroupNode - Texture-based async node for grouped tool operations
 *
 * Uses ASDisplayKit for off-main-thread layout:
 * - Color-coded headers (Read=Blue, Edit=Purple, Bash=Green)
 * - Expandable/collapsible items
 * - Shimmer effect for active operations
 */
@interface EXChatGroupNode : ASCellNode

/// Initialize as a group header cell
/// @param type Group type string ("read", "edit", "bash")
/// @param itemCount Number of items in the group
/// @param isExpanded Whether the group is expanded
/// @param isLatest Whether this is the latest active group
/// @param width Container width for layout
- (instancetype)initAsHeaderWithType:(NSString *)type
                           itemCount:(NSInteger)itemCount
                          isExpanded:(BOOL)isExpanded
                            isLatest:(BOOL)isLatest
                               width:(CGFloat)width;

/// Initialize as a group header cell with embedded items (L-shape display)
/// @param type Group type string ("read", "edit", "bash")
/// @param itemCount Number of items in the group
/// @param isExpanded Whether the group is expanded
/// @param isLatest Whether this is the latest active group
/// @param width Container width for layout
/// @param items Array of item strings (file paths, commands, etc.)
- (instancetype)initAsHeaderWithType:(NSString *)type
                           itemCount:(NSInteger)itemCount
                          isExpanded:(BOOL)isExpanded
                            isLatest:(BOOL)isLatest
                               width:(CGFloat)width
                               items:(NSArray<NSString *> *)items;

/// Initialize as an item cell within an expanded group
/// @param text The item text (file path, command, etc.)
/// @param type Group type string for color theming
/// @param width Container width for layout
- (instancetype)initAsItemWithText:(NSString *)text
                              type:(NSString *)type
                             width:(CGFloat)width;

// Helper to convert type string to enum
+ (EXChatGroupType)groupTypeFromString:(NSString *)typeString;

/// Callback when header is tapped (for expand/collapse)
@property (nonatomic, copy, nullable) void (^onHeaderTapped)(void);

@end

NS_ASSUME_NONNULL_END
