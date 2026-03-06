// Copyright 2015-present 650 Industries. All rights reserved.

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

NS_ASSUME_NONNULL_BEGIN

@protocol EXWebPreviewViewDelegate <NSObject>

@optional
- (void)webPreviewViewDidStartLoading:(UIView *)webPreviewView;
- (void)webPreviewViewDidFinishLoading:(UIView *)webPreviewView;
- (void)webPreviewView:(UIView *)webPreviewView didFailWithError:(NSError *)error;
- (void)webPreviewView:(UIView *)webPreviewView didNavigateToURL:(NSURL *)url;

@end

@interface EXWebPreviewView : UIView <WKNavigationDelegate, WKUIDelegate>

@property (nonatomic, strong, readonly) WKWebView *webView;
@property (nonatomic, strong, readonly) UIView *navigationBar;
@property (nonatomic, strong, readonly) UITextField *urlTextField;
@property (nonatomic, strong, readonly) UIButton *backButton;
@property (nonatomic, strong, readonly) UIButton *forwardButton;
@property (nonatomic, strong, readonly) UIButton *refreshButton;
@property (nonatomic, strong, readonly) UIProgressView *progressView;

@property (nonatomic, weak, nullable) id<EXWebPreviewViewDelegate> delegate;
@property (nonatomic, strong, nullable) NSURL *currentURL;

// Navigation methods
- (void)loadURL:(NSURL *)url;
- (void)goBack;
- (void)goForward;
- (void)reload;
- (void)stopLoading;

// URL bar methods
- (void)updateURLDisplay:(NSURL *)url;
- (void)setURLBarEditable:(BOOL)editable;

// State queries
- (BOOL)canGoBack;
- (BOOL)canGoForward;
- (BOOL)isLoading;

@end

NS_ASSUME_NONNULL_END
