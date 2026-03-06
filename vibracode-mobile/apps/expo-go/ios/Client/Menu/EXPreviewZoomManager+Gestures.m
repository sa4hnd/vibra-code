// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager.h"
#import "EXPreviewZoomManager+Private.h"

@implementation EXPreviewZoomManager (Gestures)

#pragma mark - Gesture Handlers

- (void)handleTap:(UITapGestureRecognizer *)gestureRecognizer
{
  if (!self.isZoomed) {
    return;
  }

  // Check if tap is on the top bar - don't zoom in if tapping controls
  if (self.topBarView && self.topBarView.superview) {
    CGPoint tapLocationInSuperview = [gestureRecognizer locationInView:self.topBarView.superview];
    if (CGRectContainsPoint(self.topBarView.frame, tapLocationInSuperview)) {
      // Tap is on top bar, don't zoom in
      NSLog(@"🔵 [Gestures] Tap on top bar, ignoring");
      return;
    }
  }

  // Check if tap is on the bottom bar
  if (self.bottomBarView && self.bottomBarView.superview) {
    CGPoint tapLocationInSuperview = [gestureRecognizer locationInView:self.bottomBarView.superview];
    if (CGRectContainsPoint(self.bottomBarView.frame, tapLocationInSuperview)) {
      // Tap is on bottom bar, don't zoom in
      NSLog(@"🔵 [Gestures] Tap on bottom bar, ignoring");
      return;
    }
  }

  // Tap is on preview container, zoom in
  NSLog(@"🔵 [Gestures] Tap on preview, zooming in");
  [self zoomIn];
}

- (void)handleSuperviewTap:(UITapGestureRecognizer *)gestureRecognizer
{
  // Dismiss keyboard when tapping on empty space around preview
  if (!self.isZoomed) {
    return;
  }
  
  CGPoint tapLocation = [gestureRecognizer locationInView:gestureRecognizer.view];
  
  // Check if tap is on preview container - if so, let preview handle it
  if (self.previewContainerView && CGRectContainsPoint(self.previewContainerView.frame, tapLocation)) {
    return; // Let preview container's tap gesture handle it
  }
  
  // Check if tap is on bottom bar - if so, don't dismiss keyboard
  if (self.bottomBarView && CGRectContainsPoint(self.bottomBarView.frame, tapLocation)) {
    return;
  }
  
  // Check if tap is on top bar - if so, don't dismiss keyboard
  if (self.topBarView && CGRectContainsPoint(self.topBarView.frame, tapLocation)) {
    return;
  }
  
  // Check if tap is on chat view - dismiss keyboard if it's open
  if (self.chatView && CGRectContainsPoint(self.chatView.frame, tapLocation)) {
    // Dismiss keyboard when tapping on chat view
    if ([self respondsToSelector:@selector(inputTextView)]) {
      UITextView *inputTextView = [self performSelector:@selector(inputTextView)];
      if (inputTextView && inputTextView.isFirstResponder) {
        [inputTextView resignFirstResponder];
      }
    }
    // Also check chatInputField for backward compatibility
    if (self.chatInputField && self.chatInputField.isFirstResponder) {
      [self.chatInputField resignFirstResponder];
    }
    return;
  }
  
  // Tap is on empty space - dismiss keyboard if it's open
  if (self.isKeyboardVisible) {
    if ([self respondsToSelector:@selector(inputTextView)]) {
      UITextView *inputTextView = [self performSelector:@selector(inputTextView)];
      if (inputTextView && inputTextView.isFirstResponder) {
        [inputTextView resignFirstResponder];
      }
    }
    // Also check chatInputField for backward compatibility
    if (self.chatInputField && self.chatInputField.isFirstResponder) {
      [self.chatInputField resignFirstResponder];
    }
  }
}

@end

