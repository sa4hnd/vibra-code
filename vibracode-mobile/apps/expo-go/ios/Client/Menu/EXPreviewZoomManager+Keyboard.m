// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager.h"
#import "EXPreviewZoomManager+Private.h"
#import "EXChatBackendService.h"

@implementation EXPreviewZoomManager (Keyboard)

#pragma mark - UITextFieldDelegate

- (BOOL)textFieldShouldReturn:(UITextField *)textField
{
  // Send message when return is pressed
  NSString *text = [textField.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if (text.length > 0 && !self.isSendingMessage && self.chatSessionId) {
    // Call sendChatMessage from ChatView category
    if ([self respondsToSelector:@selector(sendChatMessage:)]) {
      [self performSelector:@selector(sendChatMessage:) withObject:text];
      textField.text = @"";
    }
  }
  [textField resignFirstResponder];
  return YES;
}

#pragma mark - UITextViewDelegate

- (BOOL)textView:(UITextView *)textView shouldChangeTextInRange:(NSRange)range replacementText:(NSString *)text
{
  // Handle deletion - check if deleting part of a tag
  if (text.length == 0 && range.length > 0) {
    // Text is being deleted
    if (self.apiTagRanges && self.apiTagRanges.count > 0) {
      // Check if deletion range overlaps with any tag
      for (id tagData in [self.apiTagRanges copy]) {
        NSRange tagRange;

        // Handle both NSDictionary (from studio modals) and NSValue (from text parsing)
        if ([tagData isKindOfClass:[NSDictionary class]]) {
          NSDictionary *tagInfo = (NSDictionary *)tagData;
          NSValue *rangeValue = tagInfo[@"range"];
          tagRange = [rangeValue rangeValue];
        } else if ([tagData isKindOfClass:[NSValue class]]) {
          tagRange = [(NSValue *)tagData rangeValue];
        } else {
          continue;
        }

        // Check if deleted range overlaps with tag range
        NSRange intersection = NSIntersectionRange(range, tagRange);
        if (intersection.length > 0) {
          // Part of tag is being deleted - remove entire tag
          NSString *currentText = textView.attributedText ? textView.attributedText.string : textView.text;
          NSMutableString *mutableText = [currentText mutableCopy];

          // Remove entire tag including @ symbol
          [mutableText deleteCharactersInRange:tagRange];

          // Update text view
          textView.text = mutableText;

          // Remove tag from ranges
          [self.apiTagRanges removeObject:tagData];

          // Update highlighting
          [[NSNotificationCenter defaultCenter] postNotificationName:UITextViewTextDidChangeNotification object:textView];

          // Adjust cursor position
          NSInteger newLocation = range.location;
          if (tagRange.location < range.location) {
            newLocation = tagRange.location;
          }
          textView.selectedRange = NSMakeRange(newLocation, 0);

          return NO; // Don't perform default deletion
        } else if (range.location < tagRange.location) {
          // Text before tag was deleted - adjust tag range
          NSRange newTagRange = NSMakeRange(MAX(0, tagRange.location - range.length), tagRange.length);
          NSInteger index = [self.apiTagRanges indexOfObject:tagData];
          if (index != NSNotFound) {
            // Create updated entry with new range
            if ([tagData isKindOfClass:[NSDictionary class]]) {
              NSMutableDictionary *updatedTagInfo = [(NSDictionary *)tagData mutableCopy];
              updatedTagInfo[@"range"] = [NSValue valueWithRange:newTagRange];
              [self.apiTagRanges replaceObjectAtIndex:index withObject:updatedTagInfo];
            } else {
              [self.apiTagRanges replaceObjectAtIndex:index withObject:[NSValue valueWithRange:newTagRange]];
            }
          }
        }
      }
    }
  }
  
  // Handle return key to send message
  if ([text isEqualToString:@"\n"]) {
    // Block sending while agent is running
    if (self.isAgentRunning) {
      NSLog(@"🚫 [Keyboard] Send blocked - agent is currently running");
      return NO;
    }

    // Check billing status - block if user cannot send
    if (!self.canSendMessage) {
      NSLog(@"🚫 [Keyboard] Send blocked - user has no tokens/credits");
      // Show the billing limit alert
      if ([self respondsToSelector:@selector(showBillingLimitReachedAlert)]) {
        [self performSelector:@selector(showBillingLimitReachedAlert)];
      }
      return NO;
    }

    // Get text from attributed string if available, otherwise plain text
    NSString *messageText = @"";
    if (textView.attributedText) {
      messageText = [textView.attributedText.string stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    } else {
      messageText = [textView.text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    }

    // Check if there's text OR pending images to send
    BOOL hasText = messageText.length > 0;
    BOOL hasImages = self.pendingImageAttachments && self.pendingImageAttachments.count > 0;

    if ((hasText || hasImages) && !self.isSendingMessage && self.chatSessionId) {
      // Set flag to prevent notification handler from interfering
      self.isResettingInput = YES;

      if ([self respondsToSelector:@selector(sendChatMessage:)]) {
        [self performSelector:@selector(sendChatMessage:) withObject:messageText];

        // Clear text and reset to placeholder
        textView.text = @"Message";
        textView.textColor = [UIColor colorWithWhite:0.5 alpha:1.0];
        textView.attributedText = nil;

        // Clear tag ranges
        if (self.apiTagRanges) {
          [self.apiTagRanges removeAllObjects];
        }

        // Clear image path mappings (paths have been sent with message)
        if (self.imagePathMappings) {
          [self.imagePathMappings removeAllObjects];
        }

        // Clear video path mappings (paths have been sent with message)
        if (self.videoPathMappings) {
          [self.videoPathMappings removeAllObjects];
        }

        // Clear audio path mappings (paths have been sent with message)
        if (self.audioPathMappings) {
          [self.audioPathMappings removeAllObjects];
        }

        // Reset height to original size
        if ([self respondsToSelector:@selector(inputHeightConstraint)]) {
          NSLayoutConstraint *heightConstraint = [self performSelector:@selector(inputHeightConstraint)];
          if (heightConstraint) {
            heightConstraint.constant = 40;
            // Reset input container height using stored constraint
            if (self.inputContainerHeightConstraint) {
              self.inputContainerHeightConstraint.constant = 52;
            }

            // Apply layout without animation
            [textView setNeedsLayout];
            [textView layoutIfNeeded];
            if (textView.superview.superview) {
              [textView.superview.superview setNeedsLayout];
              [textView.superview.superview layoutIfNeeded];
            }
          }
        }

        // Clear flag after layout is done
        self.isResettingInput = NO;
      }
    }
    return NO; // Don't insert the newline
  }
  return YES;
}

#pragma mark - Keyboard Handling

- (void)keyboardWillShow:(NSNotification *)notification
{
  if (!self.isZoomed) {
    return;
  }
  
  NSDictionary *userInfo = notification.userInfo;
  CGRect keyboardFrame = [userInfo[UIKeyboardFrameEndUserInfoKey] CGRectValue];
  NSTimeInterval duration = [userInfo[UIKeyboardAnimationDurationUserInfoKey] doubleValue];
  UIViewAnimationCurve curve = [userInfo[UIKeyboardAnimationCurveUserInfoKey] integerValue];
  
  CGFloat keyboardHeight = keyboardFrame.size.height;
  
  if (self.previewContainerView && !self.isKeyboardVisible) {
    self.originalPreviewTransform = self.previewContainerView.layer.transform;
  }
  
  self.isKeyboardVisible = YES;
  
  // Update bottom bar for keyboard visibility (show settings/image/mic/send icons)
  if ([self respondsToSelector:@selector(updateBottomBarForKeyboardVisible:)]) {
    [self updateBottomBarForKeyboardVisible:YES];
  }

  // Adjust bottom bar to float above keyboard with 12pt gap (FoundationChat style)
  if (self.bottomBarBottomConstraint) {
    self.bottomBarBottomConstraint.constant = -(keyboardHeight + 12);
  }
  
  // Adjust scroll view to end above bottom bar
  if (self.chatScrollViewBottomConstraint && self.bottomBarView) {
    CGFloat bottomBarHeight = self.bottomBarView.frame.size.height;
    self.chatScrollViewBottomConstraint.constant = -(bottomBarHeight + keyboardHeight);
  }
  
  // Scale down and move preview up
  CATransform3D previewTransform = self.originalPreviewTransform;
  if (!CATransform3DIsIdentity(self.originalPreviewTransform)) {
    previewTransform = CATransform3DTranslate(self.originalPreviewTransform, 0, -keyboardHeight, 0);
    CGFloat additionalScale = 0.35 / 0.55;
    previewTransform = CATransform3DScale(previewTransform, additionalScale, additionalScale, 1.0);
  }
  
  if (self.bottomBarView && self.bottomBarView.superview) {
    [self.bottomBarView.superview bringSubviewToFront:self.bottomBarView];
    self.bottomBarView.layer.zPosition = 1000.0;
  }

  // PERFORMANCE: Force layout BEFORE animation to calculate new positions
  // Calling layoutIfNeeded inside animation block forces recalculation every frame (bad for 60fps)
  if (self.bottomBarView && self.bottomBarView.superview) {
    [self.bottomBarView.superview setNeedsLayout];
  }
  if (self.chatScrollView && self.chatScrollView.superview) {
    [self.chatScrollView.superview setNeedsLayout];
  }

  // Use UIViewPropertyAnimator for smooth, interruptible keyboard animation
  // This matches iOS system keyboard animation behavior
  UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
      initWithDampingRatio:1.0];  // Critical damping for keyboard (no bounce)

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:duration
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;

  [animator addAnimations:^{
    if (weakSelf.previewContainerView) {
      weakSelf.previewContainerView.layer.transform = previewTransform;
    }

    // Apply the layout changes that were marked with setNeedsLayout
    if (weakSelf.bottomBarView && weakSelf.bottomBarView.superview) {
      [weakSelf.bottomBarView.superview layoutIfNeeded];
    }

    if (weakSelf.chatScrollView && weakSelf.chatScrollView.superview) {
      [weakSelf.chatScrollView.superview layoutIfNeeded];
    }
  }];

  [animator addCompletion:^(UIViewAnimatingPosition finalPosition) {
    [weakSelf scrollChatToBottom];
  }];

  [animator startAnimation];
}

- (void)keyboardWillHide:(NSNotification *)notification
{
  if (!self.isZoomed) {
    return;
  }
  
  NSDictionary *userInfo = notification.userInfo;
  NSTimeInterval duration = [userInfo[UIKeyboardAnimationDurationUserInfoKey] doubleValue];
  UIViewAnimationCurve curve = [userInfo[UIKeyboardAnimationCurveUserInfoKey] integerValue];
  
  self.isKeyboardVisible = NO;
  
  // Update bottom bar for keyboard visibility (hide settings/image/mic/send icons)
  if ([self respondsToSelector:@selector(updateBottomBarForKeyboardVisible:)]) {
    [self updateBottomBarForKeyboardVisible:NO];
  }

  // Restore floating position with 12pt gap from bottom (FoundationChat style)
  if (self.bottomBarBottomConstraint) {
    self.bottomBarBottomConstraint.constant = -12;
  }
  
  // Reset scroll view bottom constraint
  if (self.chatScrollViewBottomConstraint && self.bottomBarView) {
    CGFloat bottomBarHeight = self.bottomBarView.frame.size.height;
    self.chatScrollViewBottomConstraint.constant = -bottomBarHeight;
  }
  
  CATransform3D originalTransform = self.originalPreviewTransform;
  if (CATransform3DIsIdentity(self.originalPreviewTransform) && self.previewContainerView) {
    CATransform3D fallbackTransform = CATransform3DIdentity;
    CGFloat perspective = [self isIPad] ? -1.0 / 1200.0 : -1.0 / 1000.0;
    fallbackTransform.m34 = perspective;
    CGFloat scale = [self isIPad] ? 0.68 : 0.55;
    fallbackTransform = CATransform3DScale(fallbackTransform, scale, scale, 1.0);
    CGFloat rotationAngle = [self isIPad] ? 0.08 : 0.1;
    fallbackTransform = CATransform3DRotate(fallbackTransform, rotationAngle, 1.0, 0.0, 0.0);
    originalTransform = fallbackTransform;
  }
  
  if (self.bottomBarView && self.bottomBarView.superview) {
    [self.bottomBarView.superview bringSubviewToFront:self.bottomBarView];
    self.bottomBarView.layer.zPosition = 1000.0;
  }

  // PERFORMANCE: Mark views for layout BEFORE animation
  if (self.bottomBarView && self.bottomBarView.superview) {
    [self.bottomBarView.superview setNeedsLayout];
  }
  if (self.chatScrollView && self.chatScrollView.superview) {
    [self.chatScrollView.superview setNeedsLayout];
  }

  // Use UIViewPropertyAnimator for smooth, interruptible keyboard animation
  UISpringTimingParameters *springParams = [[UISpringTimingParameters alloc]
      initWithDampingRatio:1.0];  // Critical damping for keyboard (no bounce)

  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc]
      initWithDuration:duration
      timingParameters:springParams];

  __weak typeof(self) weakSelf = self;

  [animator addAnimations:^{
    if (weakSelf.previewContainerView) {
      weakSelf.previewContainerView.layer.transform = originalTransform;
    }

    if (weakSelf.bottomBarView && weakSelf.bottomBarView.superview) {
      [weakSelf.bottomBarView.superview layoutIfNeeded];
    }

    if (weakSelf.chatScrollView && weakSelf.chatScrollView.superview) {
      [weakSelf.chatScrollView.superview layoutIfNeeded];
    }
  }];

  [animator startAnimation];
}


@end

