// Copyright 2015-present 650 Industries. All rights reserved.

#import <UIKit/UIKit.h>
#import <AsyncDisplayKit/AsyncDisplayKit.h>
#import <IGListKit/IGListKit.h>

NS_ASSUME_NONNULL_BEGIN

@class EXChatMessageModel;

// Protocol for chat list delegate
@protocol EXChatListAdapterDelegate <NSObject>

- (void)chatListDidRequestRefresh;
- (void)chatListDidTapGroup:(NSString *)groupId;
- (void)chatListDidScrollToTop;

@end

// Texture + IGListKit adapter for chat messages
// Uses ASCollectionNode for off-main-thread rendering with IGListKit for efficient diffing
// Uses DifferenceKit through IGListKit for optimal performance
@interface EXChatListAdapter : NSObject <IGListAdapterDataSource, ASCollectionDelegate, ASCollectionDataSource>

@property (nonatomic, weak, nullable) id<EXChatListAdapterDelegate> delegate;
@property (nonatomic, strong, readonly) IGListAdapter *adapter;
@property (nonatomic, strong, readonly) ASCollectionNode *collectionNode;
@property (nonatomic, strong, readonly) UICollectionView *collectionView; // For compatibility

- (instancetype)initWithViewController:(UIViewController *)viewController
                         containerView:(UIView *)containerView;

// Data management
- (void)updateWithMessages:(NSArray<NSDictionary *> *)messages
            groupedMessages:(NSArray<NSDictionary *> *)groupedMessages
           expandedGroups:(NSDictionary<NSString *, NSNumber *> *)expandedGroups
         latestExpandableGroupId:(nullable NSString *)latestGroupId
                 animated:(BOOL)animated;

// Initial load with completion - use this for first load to set scroll position after layout
- (void)updateWithMessages:(NSArray<NSDictionary *> *)messages
            groupedMessages:(NSArray<NSDictionary *> *)groupedMessages
           expandedGroups:(NSDictionary<NSString *, NSNumber *> *)expandedGroups
         latestExpandableGroupId:(nullable NSString *)latestGroupId
                 animated:(BOOL)animated
               completion:(nullable void (^)(void))completion;

- (void)updateStatusMessage:(nullable NSString *)statusMessage
                  isWorking:(BOOL)isWorking;

// Toggle a group's expanded state without full refresh
// More efficient for expand/collapse operations
- (void)toggleGroupExpanded:(NSString *)groupId;

- (void)scrollToBottom:(BOOL)animated;
- (void)scrollToBottomImmediate; // Synchronous scroll without animation (use in completion blocks)
- (void)scrollToBottomIfNeeded:(BOOL)onlyIfNearBottom animated:(BOOL)animated;
- (void)setInitialScrollPosition; // Sets scroll to bottom without animation, for initial load
- (void)setInitialScrollPositionWithCompletion:(nullable void (^)(void))completion; // Async version that waits for Texture layout

// Controls whether new cells animate when entering visible state
// Set to NO during initial load to prevent visible scroll effect
@property (nonatomic, assign) BOOL cellAppearanceAnimationsEnabled;

@end

NS_ASSUME_NONNULL_END
