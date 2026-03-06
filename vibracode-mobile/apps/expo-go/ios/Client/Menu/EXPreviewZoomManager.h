// Copyright 2015-present 650 Industries. All rights reserved.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface EXPreviewZoomManager : NSObject

/**
 * Returns singleton instance of the manager.
 */
+ (nonnull instancetype)sharedInstance;

/**
 * Returns bool value whether the preview is zoomed out.
 */
- (BOOL)isZoomed;

/**
 * Sets the zoomed state (used to reset state when view hierarchy is broken).
 */
- (void)setIsZoomed:(BOOL)isZoomed;

/**
 * Toggles the zoom state of the preview.
 */
- (void)toggleZoom;

/**
 * Zooms out the preview (scales down with 3D effect).
 * @param completion Optional block called when animation completes.
 */
- (void)zoomOut;
- (void)zoomOutWithCompletion:(void (^_Nullable)(void))completion;

/**
 * Zooms in the preview (restores to normal size).
 */
- (void)zoomIn;

/**
 * Sets the app name to display in the top bar (from Convex database).
 */
- (void)setAppName:(NSString *)appName;

/**
 * Toggles the chat interface (shows/hides chat view).
 */
- (void)toggleChat;

/**
 * Handles contentView replacement when app reloads/restarts while zoomed out.
 */
- (void)handleContentViewReplacement:(UIView *)newContentView;

/**
 * Re-applies the background color to the superview (used when app comes back to foreground).
 */
- (void)reapplyBackgroundColor;

/**
 * Returns whether zoom is needed after reload.
 */
- (BOOL)needsZoomAfterReload;

/**
 * Sets whether zoom is needed after reload.
 */
- (void)setNeedsZoomAfterReload:(BOOL)needsZoom;

/**
 * Sets the project type ("mobile" or "web").
 */
- (void)setProjectType:(NSString *)projectType;

/**
 * Returns the current project type.
 */
- (NSString *)projectType;

/**
 * Loads a web project with the given URL.
 * Creates a web preview view and loads the URL.
 */
- (void)loadWebProject:(NSURL *)webUrl;

/**
 * Returns whether the current preview is a web project.
 */
- (BOOL)isWebPreview;

/**
 * Returns the preview container view (used for error view positioning when zoomed).
 */
- (UIView * _Nullable)previewContainerView;

/**
 * Handles error view being shown. Properly positions it in zoom hierarchy and hides splash screen.
 */
- (void)handleErrorViewShown:(UIView * _Nonnull)errorView;

@end

