// Copyright 2015-present 650 Industries. All rights reserved.

#import "EXPreviewZoomManager+Private.h"
#import "EXPreviewZoomManager.h"
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// Forward declarations
@class EXAPIModalViewController;
@class EXAPIModelDetailViewController;

// API Modal View Controller
@interface EXAPIModalViewController
    : UIViewController <UITableViewDataSource, UITableViewDelegate,
                        UIAdaptivePresentationControllerDelegate>

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) UIScrollView *categoryScrollView;
@property(nonatomic, strong) UIView *categoryContainer;
@property(nonatomic, strong) NSArray<UIButton *> *categoryButtons;
@property(nonatomic, strong) UITableView *modelsTableView;
@property(nonatomic, strong) UIButton *addToPromptButton;
@property(nonatomic, strong) NSArray<NSDictionary *> *models;
@property(nonatomic, strong) NSArray<NSDictionary *> *filteredModels;
@property(nonatomic, assign) NSInteger selectedCategoryIndex;
@property(nonatomic, strong) NSMutableSet<NSString *> *selectedModelIds;
@property(nonatomic, strong)
    NSCache<NSString *, UIImage *> *imageCache; // Cache for loaded images
@property(nonatomic, strong)
    UIVisualEffectView *glassBackgroundView; // Glass effect background

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager;
- (void)loadImageFromURL:(NSString *)urlString
            forImageView:(UIImageView *)imageView;

@end

// API Model Detail View Controller
@interface EXAPIModelDetailViewController : UIViewController

@property(nonatomic, weak) EXPreviewZoomManager *manager;
@property(nonatomic, strong) NSDictionary *model;
@property(nonatomic, strong) NSCache<NSString *, UIImage *> *imageCache;

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager
                          model:(NSDictionary *)model;
- (void)loadImageFromURL:(NSString *)urlString
            forImageView:(UIImageView *)imageView;

@end

// Category implementation
@implementation EXPreviewZoomManager (APIModal)

- (void)showAPIModal {
  if (self.apiModalPresented) {
    return; // Already shown
  }

  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  if (!window || !window.rootViewController) {
    return;
  }

  // Find topmost view controller
  UIViewController *topVC = window.rootViewController;
  while (topVC.presentedViewController) {
    topVC = topVC.presentedViewController;
  }

  // Initialize selected models array if needed
  if (!self.selectedAPIModels) {
    self.selectedAPIModels = [NSMutableArray array];
  }

  // Initialize tag ranges if needed
  if (!self.apiTagRanges) {
    self.apiTagRanges = [NSMutableArray array];
  }

  EXAPIModalViewController *modalVC =
      [[EXAPIModalViewController alloc] initWithManager:self];

  // Wrap in navigation controller for detail view navigation
  UINavigationController *navController =
      [[UINavigationController alloc] initWithRootViewController:modalVC];

  // Make navigation controller view transparent for glass effect
  navController.view.backgroundColor = [UIColor clearColor];

  // Hide navigation bar to remove white space at top
  // We'll handle this in viewWillAppear instead to allow detail view to show it
  // [navController setNavigationBarHidden:YES animated:NO];

  self.apiModalViewController = navController;

  // Configure as bottom sheet with medium and large detents, default to large
  navController.modalPresentationStyle = UIModalPresentationPageSheet;
  if (@available(iOS 15.0, *)) {
    UISheetPresentationController *sheet =
        navController.sheetPresentationController;
    if (sheet) {
      sheet.detents = @[
        [UISheetPresentationControllerDetent mediumDetent],
        [UISheetPresentationControllerDetent largeDetent]
      ];
      sheet.selectedDetentIdentifier =
          UISheetPresentationControllerDetentIdentifierLarge; // Open fully by
                                                              // default
      sheet.preferredCornerRadius = 24.0;
      sheet.prefersGrabberVisible = YES;
      sheet.prefersEdgeAttachedInCompactHeight = YES;
      sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = YES;
      sheet.largestUndimmedDetentIdentifier =
          nil; // Dim background at all sizes
    }
  }

  // Set delegate to handle dismissal
  navController.presentationController.delegate = modalVC;

  // Present modal
  [topVC presentViewController:navController animated:YES completion:nil];
  self.apiModalPresented = YES;
}

- (void)insertAPITag:(NSString *)tagName {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  // Get current text or attributed text
  NSString *currentText = @"";
  NSRange selectedRange = inputTextView.selectedRange;

  if (inputTextView.attributedText) {
    currentText = inputTextView.attributedText.string ?: @"";
  } else {
    currentText = inputTextView.text ?: @"";
  }

  // Clear placeholder text if present
  if ([currentText isEqualToString:@"Message"]) {
    currentText = @"";
    selectedRange = NSMakeRange(0, 0);
    inputTextView.textColor = [UIColor whiteColor];
  }

  // Insert tag at cursor position or append
  NSString *tagString = [NSString stringWithFormat:@"@%@ ", tagName];

  // Insert tag
  NSString *newText =
      [currentText stringByReplacingCharactersInRange:selectedRange
                                           withString:tagString];

  // Calculate tag range
  NSRange tagRange = NSMakeRange(selectedRange.location, tagString.length);

  // Update text with attributed string
  [self updateTextInputWithAttributedStringAndTag:newText tagRange:tagRange];

  // Update cursor position
  inputTextView.selectedRange =
      NSMakeRange(selectedRange.location + tagString.length, 0);
}

- (void)updateTextInputWithAttributedString:
    (NSAttributedString *)attributedString {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  inputTextView.attributedText = attributedString;

  // Trigger text change notification
  [[NSNotificationCenter defaultCenter]
      postNotificationName:UITextViewTextDidChangeNotification
                    object:inputTextView];
}

- (void)updateTextInputWithAttributedStringAndTag:(NSString *)text
                                         tagRange:(NSRange)tagRange {
  UITextView *inputTextView = self.inputTextView;
  if (!inputTextView) {
    return;
  }

  NSMutableAttributedString *attributedString =
      [[NSMutableAttributedString alloc] initWithString:text];

  // Apply default attributes
  UIFont *font = [UIFont systemFontOfSize:17 weight:UIFontWeightRegular];
  UIColor *textColor = [UIColor whiteColor];
  [attributedString addAttributes:@{
    NSFontAttributeName : font,
    NSForegroundColorAttributeName : textColor
  }
                            range:NSMakeRange(0, attributedString.length)];

  // Apply green background to tag
  UIColor *tagColor = [UIColor colorWithRed:0.0
                                      green:0.8
                                       blue:0.4
                                      alpha:1.0]; // Green color
  [attributedString addAttribute:NSBackgroundColorAttributeName
                           value:tagColor
                           range:tagRange];

  // Store tag range with type info for color differentiation
  NSDictionary *tagInfo = @{
    @"range": [NSValue valueWithRange:tagRange],
    @"type": @"api",
    @"color": tagColor
  };
  [self.apiTagRanges addObject:tagInfo];

  inputTextView.attributedText = attributedString;

  // Trigger text change notification
  [[NSNotificationCenter defaultCenter]
      postNotificationName:UITextViewTextDidChangeNotification
                    object:inputTextView];
}

@end

// MARK: - EXAPIModalViewController Implementation

@implementation EXAPIModalViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager {
  self = [super init];
  if (self) {
    _manager = manager;
    _selectedCategoryIndex = 0;
    _selectedModelIds = [NSMutableSet set];
    _imageCache = [[NSCache alloc] init];
    _imageCache.countLimit = 50; // Cache up to 50 images

    // Initialize with sample data (will be replaced with actual API data)
    _models = [self loadSampleModels];
    // Filter by default category (text generation)
    NSArray *categoryKeys = @[ @"text", @"image", @"data", @"audio", @"video" ];
    NSString *categoryKey = categoryKeys[0];
    NSPredicate *predicate =
        [NSPredicate predicateWithFormat:@"category == %@", categoryKey];
    _filteredModels = [_models filteredArrayUsingPredicate:predicate];
  }
  return self;
}

- (NSArray<NSDictionary *> *)loadSampleModels {
  // Sample models - will be replaced with actual API data from external source
  return @[
    // Text generation models
    @{
      @"id" : @"gpt-mini",
      @"name" : @"GPT-5 Mini",
      @"category" : @"text",
      @"icon" : @"sparkles",
      @"iconUrl" : @"https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/"
                   @"ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png",
      @"tag" : @"Smart",
      @"tagColor" : @"green",
      @"description" :
          @"OpenAI GPT-5 Mini is a fast yet advanced AI chatbot developed by "
          @"OpenAI. It's very good at a wide range of skills like chatting, "
          @"content generation, coding, and normal conversational "
          @"interactions. This version of GPT-5 optimizes for speed.",
      @"cost" : @"0.0020"
    },
    @{
      @"id" : @"gemini-pro",
      @"name" : @"Gemini 3 Pro",
      @"category" : @"text",
      @"icon" : @"star.fill",
      @"iconUrl" : @"https://www.google.com/images/branding/googlelogo/2x/"
                   @"googlelogo_color_272x92dp.png",
      @"tag" : @"Advanced",
      @"tagColor" : @"darkGreen",
      @"description" :
          @"Google's Gemini 3 Pro is an advanced AI model with exceptional "
          @"capabilities in reasoning, coding, and multimodal understanding.",
      @"cost" : @"0.0050"
    },
    @{
      @"id" : @"grok-fast",
      @"name" : @"Grok 4 Fast",
      @"category" : @"text",
      @"icon" : @"bolt.fill",
      @"iconUrl" : @"",
      @"tag" : @"Cheap",
      @"tagColor" : @"lightGreen",
      @"description" : @"Grok 4 Fast is optimized for speed and cost "
                       @"efficiency, perfect for high-volume applications.",
      @"cost" : @"0.0010"
    },
    @{
      @"id" : @"claude-sonnet",
      @"name" : @"Claude Sonnet 4",
      @"category" : @"text",
      @"icon" : @"brain.head.profile",
      @"iconUrl" : @"https://www.anthropic.com/favicon.ico",
      @"tag" : @"Smart",
      @"tagColor" : @"green",
      @"description" : @"Anthropic's Claude Sonnet 4 offers excellent "
                       @"reasoning capabilities and safety features.",
      @"cost" : @"0.0030"
    },
    // Image generation models
    @{
      @"id" : @"dalle-4",
      @"name" : @"DALL-E 4",
      @"category" : @"image",
      @"icon" : @"photo.artframe",
      @"iconUrl" : @"https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/"
                   @"ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png",
      @"tag" : @"New",
      @"tagColor" : @"green",
      @"description" : @"OpenAI's latest image generation model with improved "
                       @"quality and prompt understanding.",
      @"cost" : @"0.0400"
    },
    @{
      @"id" : @"midjourney-v6",
      @"name" : @"Midjourney v6",
      @"category" : @"image",
      @"icon" : @"paintbrush.fill",
      @"iconUrl" : @"https://www.midjourney.com/favicon.ico",
      @"tag" : @"Advanced",
      @"tagColor" : @"darkGreen",
      @"description" : @"Midjourney v6 produces stunning artistic images with "
                       @"exceptional detail and style.",
      @"cost" : @"0.0500"
    },
    @{
      @"id" : @"stable-diffusion-xl",
      @"name" : @"Stable Diffusion XL",
      @"category" : @"image",
      @"icon" : @"sparkles.rectangle.stack",
      @"iconUrl" : @"https://stability.ai/favicon.ico",
      @"tag" : @"Cheap",
      @"tagColor" : @"lightGreen",
      @"description" : @"Open-source image generation model with great quality "
                       @"and customization options.",
      @"cost" : @"0.0100"
    },
    @{
      @"id" : @"imagen-3",
      @"name" : @"Imagen 3",
      @"category" : @"image",
      @"icon" : @"camera.fill",
      @"iconUrl" : @"https://www.google.com/images/branding/googlelogo/2x/"
                   @"googlelogo_color_272x92dp.png",
      @"tag" : @"Smart",
      @"tagColor" : @"green",
      @"description" : @"Google's Imagen 3 delivers high-quality "
                       @"photorealistic image generation.",
      @"cost" : @"0.0300"
    },
    // Data models
    @{
      @"id" : @"data-analyzer-pro",
      @"name" : @"Data Analyzer Pro",
      @"category" : @"data",
      @"icon" : @"chart.bar.fill",
      @"iconUrl" : @"",
      @"tag" : @"Advanced",
      @"tagColor" : @"darkGreen",
      @"description" : @"Advanced data analysis and visualization tool with "
                       @"statistical modeling capabilities.",
      @"cost" : @"0.0150"
    },
    @{
      @"id" : @"sql-assistant",
      @"name" : @"SQL Assistant",
      @"category" : @"data",
      @"icon" : @"tablecells.fill",
      @"iconUrl" : @"",
      @"tag" : @"Smart",
      @"tagColor" : @"green",
      @"description" : @"AI-powered SQL query generator and database "
                       @"optimization assistant.",
      @"cost" : @"0.0080"
    },
    @{
      @"id" : @"csv-processor",
      @"name" : @"CSV Processor",
      @"category" : @"data",
      @"icon" : @"doc.text.fill",
      @"iconUrl" : @"",
      @"tag" : @"Cheap",
      @"tagColor" : @"lightGreen",
      @"description" : @"Fast CSV data processing and transformation tool.",
      @"cost" : @"0.0020"
    },
    // Audio models
    @{
      @"id" : @"whisper-large",
      @"name" : @"Whisper Large",
      @"category" : @"audio",
      @"icon" : @"waveform",
      @"iconUrl" : @"https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/"
                   @"ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png",
      @"tag" : @"Advanced",
      @"tagColor" : @"darkGreen",
      @"description" : @"OpenAI's Whisper Large for high-accuracy "
                       @"speech-to-text transcription.",
      @"cost" : @"0.0060"
    },
    @{
      @"id" : @"tts-premium",
      @"name" : @"TTS Premium",
      @"category" : @"audio",
      @"icon" : @"speaker.wave.3.fill",
      @"iconUrl" : @"",
      @"tag" : @"Smart",
      @"tagColor" : @"green",
      @"description" :
          @"Natural-sounding text-to-speech with multiple voice options.",
      @"cost" : @"0.0040"
    },
    @{
      @"id" : @"audio-summarizer",
      @"name" : @"Audio Summarizer",
      @"category" : @"audio",
      @"icon" : @"list.bullet.rectangle",
      @"iconUrl" : @"",
      @"tag" : @"Cheap",
      @"tagColor" : @"lightGreen",
      @"description" :
          @"Automatically summarize long audio files and podcasts.",
      @"cost" : @"0.0030"
    },
    // Video models
    @{
      @"id" : @"runway-gen3",
      @"name" : @"Runway Gen-3",
      @"category" : @"video",
      @"icon" : @"video.fill",
      @"iconUrl" : @"https://runwayml.com/favicon.ico",
      @"tag" : @"New",
      @"tagColor" : @"green",
      @"description" : @"State-of-the-art video generation model for creating "
                       @"high-quality videos from text.",
      @"cost" : @"0.1000"
    },
    @{
      @"id" : @"pika-1.5",
      @"name" : @"Pika 1.5",
      @"category" : @"video",
      @"icon" : @"play.rectangle.fill",
      @"iconUrl" : @"https://pika.art/favicon.ico",
      @"tag" : @"Advanced",
      @"tagColor" : @"darkGreen",
      @"description" : @"Advanced video generation with precise control over "
                       @"motion and style.",
      @"cost" : @"0.0800"
    },
    @{
      @"id" : @"video-editor-ai",
      @"name" : @"Video Editor AI",
      @"category" : @"video",
      @"icon" : @"scissors",
      @"iconUrl" : @"",
      @"tag" : @"Smart",
      @"tagColor" : @"green",
      @"description" : @"AI-powered video editing and enhancement tool.",
      @"cost" : @"0.0500"
    }
  ];
}

- (void)viewDidLoad {
  [super viewDidLoad];

  // Make the view controller's view transparent so the glass effect shows through
  self.view.backgroundColor = [UIColor clearColor];

  // Native iOS Glass Effect background - matching other UI elements
  UIVisualEffect *glassEffect = nil;
  if (@available(iOS 26.0, *)) {
    // Try to use UIGlassEffect if available
    Class glassEffectClass = NSClassFromString(@"UIGlassEffect");
    if (glassEffectClass) {
      SEL effectSelector = NSSelectorFromString(@"effectWithStyle:");
      if ([glassEffectClass respondsToSelector:effectSelector]) {
        // UIGlassEffectStyleRegular = 0
        NSMethodSignature *signature =
            [glassEffectClass methodSignatureForSelector:effectSelector];
        NSInvocation *invocation =
            [NSInvocation invocationWithMethodSignature:signature];
        [invocation setSelector:effectSelector];
        [invocation setTarget:glassEffectClass];
        NSInteger style = 0; // UIGlassEffectStyleRegular
        [invocation setArgument:&style atIndex:2];
        [invocation invoke];
        void *tempResult;
        [invocation getReturnValue:&tempResult];
        glassEffect = (__bridge id)tempResult;

        // Set interactive property
        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setInteractive:)]) {
          SEL setInteractiveSelector = @selector(setInteractive:);
          NSMethodSignature *setSig =
              [glassEffect methodSignatureForSelector:setInteractiveSelector];
          NSInvocation *setInvocation =
              [NSInvocation invocationWithMethodSignature:setSig];
          [setInvocation setSelector:setInteractiveSelector];
          [setInvocation setTarget:glassEffect];
          BOOL interactive = YES;
          [setInvocation setArgument:&interactive atIndex:2];
          [setInvocation invoke];
        }

        // Set tint color to match other UI elements
        if (glassEffect &&
            [glassEffect respondsToSelector:@selector(setTintColor:)]) {
          // Very dark tint color: Almost black
          UIColor *darkTint = [UIColor colorWithRed:0.05
                                              green:0.05
                                               blue:0.05
                                              alpha:1.0];
          [glassEffect setValue:darkTint forKey:@"tintColor"];
        }
      }
    }
    // Fallback if UIGlassEffect not available
    if (!glassEffect) {
      if (@available(iOS 13.0, *)) {
        glassEffect =
            [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
      } else {
        glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
      }
    }
  } else if (@available(iOS 13.0, *)) {
    // Fallback to SystemMaterialDark for iOS < 26.0
    glassEffect =
        [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemMaterialDark];
  } else {
    glassEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleDark];
  }

  UIVisualEffectView *backgroundView =
      [[UIVisualEffectView alloc] initWithEffect:glassEffect];
  backgroundView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view insertSubview:backgroundView atIndex:0];
  self.glassBackgroundView = backgroundView;

  // Pin glass background to all edges using constraints for proper resizing
  [NSLayoutConstraint activateConstraints:@[
    [backgroundView.topAnchor constraintEqualToAnchor:self.view.topAnchor],
    [backgroundView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [backgroundView.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor],
    [backgroundView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor]
  ]];

  // Set navigation bar title
  self.navigationItem.title = @"Select API Models";

  [self setupCategorySegmentedControl];
  [self setupModelsTableView];
  [self setupBottomActionBar];
  [self setupConstraints];

  // Filter models by default category (text generation)
  [self filterModelsByCategory];

  // Load selected models from manager
  if (self.manager.selectedAPIModels) {
    for (NSDictionary *model in self.manager.selectedAPIModels) {
      [self.selectedModelIds addObject:model[@"id"]];
    }
  }
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  // Hide navigation bar for the main list view
  [self.navigationController setNavigationBarHidden:YES animated:animated];
}

- (void)presentationControllerDidDismiss:
    (UIPresentationController *)presentationController {
  // Reset the presented flag when user dismisses via drag
  self.manager.apiModalPresented = NO;
}

- (void)viewDidLayoutSubviews {
  [super viewDidLayoutSubviews];
}

- (void)setupCategorySegmentedControl {
  // Category container - transparent to show glass effect
  self.categoryContainer = [[UIView alloc] init];
  self.categoryContainer.translatesAutoresizingMaskIntoConstraints = NO;
  self.categoryContainer.backgroundColor = [UIColor clearColor];

  // Add subtle border at bottom for depth
  CALayer *bottomBorder = [CALayer layer];
  bottomBorder.backgroundColor =
      [UIColor colorWithWhite:0.3 alpha:0.3].CGColor;
  bottomBorder.frame = CGRectMake(0, 55.5, 1000, 0.5);
  [self.categoryContainer.layer addSublayer:bottomBorder];

  [self.view addSubview:self.categoryContainer];

  // Native iOS Segmented Control for categories
  NSArray *categories = @[ @"Text", @"Image", @"Data", @"Audio", @"Video" ];
  UISegmentedControl *segmentedControl =
      [[UISegmentedControl alloc] initWithItems:categories];
  segmentedControl.translatesAutoresizingMaskIntoConstraints = NO;
  segmentedControl.selectedSegmentIndex = 0;

  // Style the segmented control with semi-transparent colors for glass effect
  if (@available(iOS 13.0, *)) {
    segmentedControl.selectedSegmentTintColor = [UIColor colorWithRed:0.3
                                                                green:0.3
                                                                 blue:0.35
                                                                alpha:0.6];
    [segmentedControl setBackgroundColor:[UIColor colorWithRed:0.2
                                                         green:0.2
                                                          blue:0.22
                                                         alpha:0.4]];
  }

  // Text attributes
  NSDictionary *normalAttributes = @{
    NSForegroundColorAttributeName : [UIColor colorWithWhite:0.6 alpha:1.0],
    NSFontAttributeName : [UIFont systemFontOfSize:13 weight:UIFontWeightMedium]
  };
  NSDictionary *selectedAttributes = @{
    NSForegroundColorAttributeName : [UIColor whiteColor],
    NSFontAttributeName : [UIFont systemFontOfSize:13
                                            weight:UIFontWeightSemibold]
  };
  [segmentedControl setTitleTextAttributes:normalAttributes
                                  forState:UIControlStateNormal];
  [segmentedControl setTitleTextAttributes:selectedAttributes
                                  forState:UIControlStateSelected];

  [segmentedControl addTarget:self
                       action:@selector(categorySegmentChanged:)
             forControlEvents:UIControlEventValueChanged];

  [self.categoryContainer addSubview:segmentedControl];

  // Store reference (we'll use categoryScrollView property to store segmented
  // control)
  self.categoryScrollView = (UIScrollView *)segmentedControl;

  // Constraints for segmented control
  [NSLayoutConstraint activateConstraints:@[
    [segmentedControl.centerYAnchor
        constraintEqualToAnchor:self.categoryContainer.centerYAnchor],
    [segmentedControl.leadingAnchor
        constraintEqualToAnchor:self.categoryContainer.leadingAnchor
                       constant:16],
    [segmentedControl.trailingAnchor
        constraintEqualToAnchor:self.categoryContainer.trailingAnchor
                       constant:-16],
    [segmentedControl.heightAnchor constraintEqualToConstant:32]
  ]];
}

- (void)setupModelsTableView {
  self.modelsTableView =
      [[UITableView alloc] initWithFrame:CGRectZero
                                   style:UITableViewStylePlain];
  self.modelsTableView.translatesAutoresizingMaskIntoConstraints = NO;
  self.modelsTableView.backgroundColor = [UIColor clearColor];
  self.modelsTableView.separatorStyle = UITableViewCellSeparatorStyleNone;
  self.modelsTableView.dataSource = self;
  self.modelsTableView.delegate = self;
  self.modelsTableView.contentInset =
      UIEdgeInsetsMake(8, 0, 8, 0); // Elegant padding
  [self.modelsTableView registerClass:[UITableViewCell class]
               forCellReuseIdentifier:@"ModelCell"];
  [self.view addSubview:self.modelsTableView];
}

- (void)setupBottomActionBar {
  // Native iOS button for "Add to prompt" - added directly to view
  self.addToPromptButton = [UIButton buttonWithType:UIButtonTypeSystem];
  self.addToPromptButton.translatesAutoresizingMaskIntoConstraints = NO;

  // Use native iOS button configuration (iOS 15+)
  if (@available(iOS 15.0, *)) {
    UIButtonConfiguration *config =
        [UIButtonConfiguration filledButtonConfiguration];
    config.title = @"Add to prompt";
    config.baseBackgroundColor = [UIColor whiteColor];
    config.baseForegroundColor = [UIColor blackColor];
    config.cornerStyle = UIButtonConfigurationCornerStyleLarge;
    config.buttonSize = UIButtonConfigurationSizeLarge;
    self.addToPromptButton.configuration = config;
  } else {
    // Fallback for older iOS - use native rounded corners
    [self.addToPromptButton setTitle:@"Add to prompt"
                            forState:UIControlStateNormal];
    [self.addToPromptButton setTitleColor:[UIColor blackColor]
                                 forState:UIControlStateNormal];
    self.addToPromptButton.backgroundColor = [UIColor whiteColor];
    self.addToPromptButton.layer.cornerRadius = 16;
    self.addToPromptButton.layer.masksToBounds = YES;
    self.addToPromptButton.titleLabel.font =
        [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  }

  [self.addToPromptButton addTarget:self
                             action:@selector(addToPromptTapped:)
                   forControlEvents:UIControlEventTouchUpInside];

  [self.view addSubview:self.addToPromptButton];

  [self updateSelectionCount];
}

- (void)setupConstraints {
  UIWindow *window = [UIApplication sharedApplication].keyWindow;
  CGFloat safeAreaBottom = 0;
  if (@available(iOS 11.0, *)) {
    safeAreaBottom = window.safeAreaInsets.bottom;
  }

  [NSLayoutConstraint activateConstraints:@[
    // Category container
    [self.categoryContainer.topAnchor
        constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
    [self.categoryContainer.leadingAnchor
        constraintEqualToAnchor:self.view.leadingAnchor],
    [self.categoryContainer.trailingAnchor
        constraintEqualToAnchor:self.view.trailingAnchor],
    [self.categoryContainer.heightAnchor constraintEqualToConstant:56],

    // Add to prompt button - directly anchored to view
    [self.addToPromptButton.leadingAnchor
        constraintEqualToAnchor:self.view.leadingAnchor
                       constant:20],
    [self.addToPromptButton.trailingAnchor
        constraintEqualToAnchor:self.view.trailingAnchor
                       constant:-20],
    [self.addToPromptButton.heightAnchor constraintEqualToConstant:50],
    [self.addToPromptButton.bottomAnchor
        constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor
                       constant:-(safeAreaBottom + 16)],

    // Models table view
    [self.modelsTableView.topAnchor
        constraintEqualToAnchor:self.categoryContainer.bottomAnchor],
    [self.modelsTableView.leadingAnchor
        constraintEqualToAnchor:self.view.leadingAnchor],
    [self.modelsTableView.trailingAnchor
        constraintEqualToAnchor:self.view.trailingAnchor],
    [self.modelsTableView.bottomAnchor
        constraintEqualToAnchor:self.addToPromptButton.topAnchor
                       constant:-16]
  ]];
}

- (void)categorySegmentChanged:(UISegmentedControl *)sender {
  self.selectedCategoryIndex = sender.selectedSegmentIndex;

  // Filter models by category
  [self filterModelsByCategory];

  // Reload table with animation
  [self.modelsTableView reloadData];
}

- (void)filterModelsByCategory {
  NSArray *categoryKeys = @[ @"text", @"image", @"data", @"audio", @"video" ];
  NSString *categoryKey = categoryKeys[self.selectedCategoryIndex];

  NSPredicate *predicate =
      [NSPredicate predicateWithFormat:@"category == %@", categoryKey];
  self.filteredModels = [self.models filteredArrayUsingPredicate:predicate];
}

- (void)updateSelectionCount {
  NSInteger count = self.selectedModelIds.count;

  // Update button state
  self.addToPromptButton.alpha = count > 0 ? 1.0 : 0.6;
  self.addToPromptButton.enabled = count > 0;
}

- (void)addToPromptTapped:(UIButton *)sender {
  if (self.selectedModelIds.count == 0) {
    return;
  }

  // Insert tags for selected models
  for (NSDictionary *model in self.models) {
    NSString *modelId = model[@"id"];
    if ([self.selectedModelIds containsObject:modelId]) {
      NSString *tagName = model[@"id"];
      [self.manager insertAPITag:tagName];
    }
  }

  // Update manager's selected models
  NSMutableArray *selectedModels = [NSMutableArray array];
  for (NSDictionary *model in self.models) {
    if ([self.selectedModelIds containsObject:model[@"id"]]) {
      [selectedModels addObject:model];
    }
  }
  self.manager.selectedAPIModels = selectedModels;

  // Dismiss modal (dismiss the navigation controller that contains this view
  // controller)
  if (self.navigationController) {
    [self.navigationController
        dismissViewControllerAnimated:YES
                           completion:^{
                             self.manager.apiModalPresented = NO;
                           }];
  } else {
    [self dismissViewControllerAnimated:YES
                             completion:^{
                               self.manager.apiModalPresented = NO;
                             }];
  }
}

#pragma mark - UITableViewDataSource

- (NSInteger)tableView:(UITableView *)tableView
    numberOfRowsInSection:(NSInteger)section {
  return self.filteredModels.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView
         cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell =
      [tableView dequeueReusableCellWithIdentifier:@"ModelCell"];
  if (!cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault
                                  reuseIdentifier:@"ModelCell"];
  }

  // Clear cell
  for (UIView *subview in cell.contentView.subviews) {
    [subview removeFromSuperview];
  }

  NSDictionary *model = self.filteredModels[indexPath.row];
  NSString *modelId = model[@"id"];
  BOOL isSelected = [self.selectedModelIds containsObject:modelId];

  // Cell background - clean design
  cell.backgroundColor = [UIColor clearColor];

  // Selected state background - semi-transparent for glass effect
  if (isSelected) {
    UIView *selectionBackground = [[UIView alloc] init];
    selectionBackground.backgroundColor = [UIColor colorWithRed:0.3
                                                          green:0.3
                                                           blue:0.35
                                                          alpha:0.5];
    selectionBackground.layer.cornerRadius = 14;
    selectionBackground.layer.borderWidth = 0.5;
    selectionBackground.layer.borderColor =
        [UIColor colorWithWhite:0.4 alpha:0.3].CGColor;
    selectionBackground.translatesAutoresizingMaskIntoConstraints = NO;
    [cell.contentView addSubview:selectionBackground];
    [cell.contentView sendSubviewToBack:selectionBackground];

    [NSLayoutConstraint activateConstraints:@[
      [selectionBackground.topAnchor
          constraintEqualToAnchor:cell.contentView.topAnchor
                         constant:4],
      [selectionBackground.leadingAnchor
          constraintEqualToAnchor:cell.contentView.leadingAnchor
                         constant:12],
      [selectionBackground.trailingAnchor
          constraintEqualToAnchor:cell.contentView.trailingAnchor
                         constant:-12],
      [selectionBackground.bottomAnchor
          constraintEqualToAnchor:cell.contentView.bottomAnchor
                         constant:-4]
    ]];
  }

  // Icon container with modern shadow
  UIView *iconContainer = [[UIView alloc] init];
  iconContainer.backgroundColor = [UIColor whiteColor];
  iconContainer.layer.cornerRadius = 12;
  iconContainer.layer.shadowColor = [UIColor blackColor].CGColor;
  iconContainer.layer.shadowOffset = CGSizeMake(0, 2);
  iconContainer.layer.shadowRadius = 4;
  iconContainer.layer.shadowOpacity = 0.25;
  iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [cell.contentView addSubview:iconContainer];

  // Icon view - will load from URL or use SF Symbol
  UIImageView *iconView = [[UIImageView alloc] init];
  iconView.contentMode = UIViewContentModeScaleAspectFit;
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:iconView];

  // Try to load from URL first, fallback to SF Symbol
  NSString *iconUrl = model[@"iconUrl"];
  if (iconUrl && iconUrl.length > 0) {
    [self loadImageFromURL:iconUrl forImageView:iconView];
  } else {
    // Fallback to SF Symbol
    UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:24
                            weight:UIImageSymbolWeightRegular];
    UIImage *iconImage = [UIImage systemImageNamed:model[@"icon"] ?: @"sparkles"
                                 withConfiguration:iconConfig];
    iconView.image = iconImage;
    iconView.tintColor = [UIColor blackColor];
  }

  // Model name - improved typography
  UILabel *nameLabel = [[UILabel alloc] init];
  nameLabel.text = model[@"name"];
  nameLabel.textColor = [UIColor whiteColor];
  nameLabel.font = [UIFont systemFontOfSize:17 weight:UIFontWeightSemibold];
  nameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [cell.contentView addSubview:nameLabel];

  // Tag badge - native iOS style
  NSString *tagText = model[@"tag"];
  UIButton *tagButton = nil;
  if (tagText) {
    tagButton = [UIButton buttonWithType:UIButtonTypeSystem];
    tagButton.translatesAutoresizingMaskIntoConstraints = NO;
    tagButton.userInteractionEnabled = NO; // Not interactive, just for display

    // Use native iOS button configuration (iOS 15+)
    if (@available(iOS 15.0, *)) {
      UIButtonConfiguration *tagConfig =
          [UIButtonConfiguration plainButtonConfiguration];
      tagConfig.title = tagText;
      tagConfig.baseForegroundColor = [UIColor whiteColor];
      tagConfig.background.backgroundColor = [UIColor colorWithWhite:0.25
                                                               alpha:1.0];
      tagConfig.background.cornerRadius = 10;
      tagConfig.contentInsets = NSDirectionalEdgeInsetsMake(4, 8, 4, 8);
      tagConfig.titleTextAttributesTransformer =
          ^NSDictionary<NSAttributedStringKey, id> *(
              NSDictionary<NSAttributedStringKey, id> *textAttributes) {
        NSMutableDictionary *newAttributes = [textAttributes mutableCopy];
        newAttributes[NSFontAttributeName] =
            [UIFont systemFontOfSize:11 weight:UIFontWeightSemibold];
        return newAttributes;
      };
      tagButton.configuration = tagConfig;
    } else {
      // Fallback for older iOS
      [tagButton setTitle:tagText forState:UIControlStateNormal];
      [tagButton setTitleColor:[UIColor whiteColor]
                      forState:UIControlStateNormal];
      tagButton.backgroundColor = [UIColor colorWithWhite:0.25 alpha:1.0];
      tagButton.layer.cornerRadius = 10;
      tagButton.layer.masksToBounds = YES;
      tagButton.titleLabel.font =
          [UIFont systemFontOfSize:11 weight:UIFontWeightSemibold];
      tagButton.contentEdgeInsets = UIEdgeInsetsMake(4, 8, 4, 8);
    }

    [cell.contentView addSubview:tagButton];
  }

  // Chevron button - tappable for detail view
  UIImageSymbolConfiguration *chevronConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:14
                          weight:UIImageSymbolWeightRegular];
  UIImage *chevronImage = [UIImage systemImageNamed:@"chevron.right"
                                  withConfiguration:chevronConfig];
  UIButton *chevronButton = [UIButton buttonWithType:UIButtonTypeCustom];
  [chevronButton setImage:chevronImage forState:UIControlStateNormal];
  chevronButton.tintColor = [UIColor colorWithWhite:0.4 alpha:1.0];
  chevronButton.translatesAutoresizingMaskIntoConstraints = NO;
  chevronButton.tag = indexPath.row;
  [chevronButton addTarget:self
                    action:@selector(chevronButtonTapped:)
          forControlEvents:UIControlEventTouchUpInside];
  [cell.contentView addSubview:chevronButton];

  // Constraints - elegant modern layout with better spacing
  [NSLayoutConstraint activateConstraints:@[
    // Icon container - slightly larger for better visibility
    [iconContainer.leadingAnchor
        constraintEqualToAnchor:cell.contentView.leadingAnchor
                       constant:20],
    [iconContainer.centerYAnchor
        constraintEqualToAnchor:cell.contentView.centerYAnchor],
    [iconContainer.widthAnchor constraintEqualToConstant:44],
    [iconContainer.heightAnchor constraintEqualToConstant:44],

    // Icon inside container
    [iconView.centerXAnchor
        constraintEqualToAnchor:iconContainer.centerXAnchor],
    [iconView.centerYAnchor
        constraintEqualToAnchor:iconContainer.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:26],
    [iconView.heightAnchor constraintEqualToConstant:26],

    // Model name - improved spacing
    [nameLabel.leadingAnchor
        constraintEqualToAnchor:iconContainer.trailingAnchor
                       constant:16],
    [nameLabel.centerYAnchor
        constraintEqualToAnchor:cell.contentView.centerYAnchor],

    // Chevron button - more refined
    [chevronButton.trailingAnchor
        constraintEqualToAnchor:cell.contentView.trailingAnchor
                       constant:-20],
    [chevronButton.centerYAnchor
        constraintEqualToAnchor:cell.contentView.centerYAnchor],
    [chevronButton.widthAnchor constraintEqualToConstant:44],
    [chevronButton.heightAnchor constraintEqualToConstant:44]
  ]];

  // Tag constraints (if exists) - elegant positioning
  if (tagButton) {
    [NSLayoutConstraint activateConstraints:@[
      [tagButton.leadingAnchor constraintEqualToAnchor:nameLabel.trailingAnchor
                                              constant:10],
      [tagButton.centerYAnchor
          constraintEqualToAnchor:cell.contentView.centerYAnchor],
      [tagButton.trailingAnchor
          constraintLessThanOrEqualToAnchor:chevronButton.leadingAnchor
                                   constant:-12],
      [tagButton.heightAnchor constraintGreaterThanOrEqualToConstant:20]
    ]];
  }

  cell.selectionStyle = UITableViewCellSelectionStyleNone;

  return cell;
}

#pragma mark - UITableViewDelegate

- (CGFloat)tableView:(UITableView *)tableView
    heightForRowAtIndexPath:(NSIndexPath *)indexPath {
  return 72; // More spacious for better visual hierarchy
}

- (void)tableView:(UITableView *)tableView
    didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSDictionary *model = self.filteredModels[indexPath.row];
  NSString *modelId = model[@"id"];

  // Toggle selection with smooth animation
  BOOL wasSelected = [self.selectedModelIds containsObject:modelId];
  if (wasSelected) {
    [self.selectedModelIds removeObject:modelId];
  } else {
    [self.selectedModelIds addObject:modelId];
  }

  [self updateSelectionCount];

  // Smooth reload animation
  [tableView reloadRowsAtIndexPaths:@[ indexPath ]
                   withRowAnimation:UITableViewRowAnimationFade];
}

- (void)loadImageFromURL:(NSString *)urlString
            forImageView:(UIImageView *)imageView {
  if (!urlString || urlString.length == 0) {
    return;
  }

  // Check cache first
  UIImage *cachedImage = [self.imageCache objectForKey:urlString];
  if (cachedImage) {
    imageView.image = cachedImage;
    return;
  }

  // Load from URL
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    return;
  }

  // Use placeholder SF Symbol while loading
  UIImageSymbolConfiguration *placeholderConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:24
                          weight:UIImageSymbolWeightRegular];
  UIImage *placeholderImage = [UIImage systemImageNamed:@"photo"
                                      withConfiguration:placeholderConfig];
  imageView.image = placeholderImage;
  imageView.tintColor = [UIColor colorWithWhite:0.3 alpha:1.0];

  // Load image asynchronously
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithURL:url
      completionHandler:^(NSData *data, NSURLResponse *response,
                          NSError *error) {
        if (error || !data) {
          dispatch_async(dispatch_get_main_queue(), ^{
            // Fallback to SF Symbol on error
            UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
                configurationWithPointSize:24
                                    weight:UIImageSymbolWeightRegular];
            UIImage *fallbackImage = [UIImage systemImageNamed:@"sparkles"
                                             withConfiguration:iconConfig];
            imageView.image = fallbackImage;
            imageView.tintColor = [UIColor blackColor];
          });
          return;
        }

        UIImage *loadedImage = [UIImage imageWithData:data];
        if (loadedImage) {
          // Cache the image
          [self.imageCache setObject:loadedImage forKey:urlString];

          dispatch_async(dispatch_get_main_queue(), ^{
            imageView.image = loadedImage;
            imageView.tintColor = nil; // Remove tint for loaded images
          });
        }
      }];

  [task resume];
}

- (void)chevronButtonTapped:(UIButton *)sender {
  NSInteger row = sender.tag;
  if (row >= 0 && row < self.filteredModels.count) {
    NSDictionary *model = self.filteredModels[row];
    [self showDetailViewForModel:model];
  }
}

- (void)showDetailViewForModel:(NSDictionary *)model {
  EXAPIModelDetailViewController *detailVC =
      [[EXAPIModelDetailViewController alloc] initWithManager:self.manager
                                                        model:model];

  // Push onto navigation controller if available, otherwise present as modal
  if (self.navigationController) {
    [self.navigationController pushViewController:detailVC animated:YES];
  } else {
    UINavigationController *navController =
        [[UINavigationController alloc] initWithRootViewController:detailVC];
    navController.modalPresentationStyle = UIModalPresentationPageSheet;
    navController.navigationBar.barTintColor = [UIColor colorWithRed:0.12
                                                               green:0.12
                                                                blue:0.12
                                                               alpha:1.0];
    navController.navigationBar.titleTextAttributes =
        @{NSForegroundColorAttributeName : [UIColor whiteColor]};
    [self presentViewController:navController animated:YES completion:nil];
  }
}

@end

// MARK: - EXAPIModelDetailViewController Implementation

@implementation EXAPIModelDetailViewController

- (instancetype)initWithManager:(EXPreviewZoomManager *)manager
                          model:(NSDictionary *)model {
  self = [super init];
  if (self) {
    _manager = manager;
    _model = model;
    _imageCache = [[NSCache alloc] init];
    _imageCache.countLimit = 50;
  }
  return self;
}

- (void)loadImageFromURL:(NSString *)urlString
            forImageView:(UIImageView *)imageView {
  if (!urlString || urlString.length == 0) {
    return;
  }

  // Check cache first
  UIImage *cachedImage = [self.imageCache objectForKey:urlString];
  if (cachedImage) {
    imageView.image = cachedImage;
    return;
  }

  // Load from URL
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    return;
  }

  // Use placeholder SF Symbol while loading
  UIImageSymbolConfiguration *placeholderConfig = [UIImageSymbolConfiguration
      configurationWithPointSize:40
                          weight:UIImageSymbolWeightRegular];
  UIImage *placeholderImage = [UIImage systemImageNamed:@"photo"
                                      withConfiguration:placeholderConfig];
  imageView.image = placeholderImage;
  imageView.tintColor = [UIColor colorWithWhite:0.3 alpha:1.0];

  // Load image asynchronously
  NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithURL:url
      completionHandler:^(NSData *data, NSURLResponse *response,
                          NSError *error) {
        if (error || !data) {
          dispatch_async(dispatch_get_main_queue(), ^{
            // Fallback to SF Symbol on error
            UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
                configurationWithPointSize:40
                                    weight:UIImageSymbolWeightRegular];
            UIImage *fallbackImage = [UIImage systemImageNamed:@"sparkles"
                                             withConfiguration:iconConfig];
            imageView.image = fallbackImage;
            imageView.tintColor = [UIColor blackColor];
          });
          return;
        }

        UIImage *loadedImage = [UIImage imageWithData:data];
        if (loadedImage) {
          // Cache the image
          [self.imageCache setObject:loadedImage forKey:urlString];

          dispatch_async(dispatch_get_main_queue(), ^{
            imageView.image = loadedImage;
            imageView.tintColor = nil; // Remove tint for loaded images
          });
        }
      }];

  [task resume];
}

- (void)viewDidLoad {
  [super viewDidLoad];

  // Modern dark background matching ChatView
  self.view.backgroundColor = [UIColor colorWithRed:0.08
                                              green:0.08
                                               blue:0.08
                                              alpha:1.0];

  // Navigation bar - elegant styling
  self.navigationItem.title = @"Details";
  self.navigationItem.leftBarButtonItem = [[UIBarButtonItem alloc]
      initWithImage:[UIImage systemImageNamed:@"chevron.left"]
              style:UIBarButtonItemStylePlain
             target:self
             action:@selector(backButtonTapped:)];
  self.navigationItem.leftBarButtonItem.tintColor = [UIColor whiteColor];

  // Modern navigation bar styling
  // Modern navigation bar styling
  if (self.navigationController) {
    UIColor *navBarColor = [UIColor colorWithRed:0.12
                                           green:0.12
                                            blue:0.14
                                           alpha:1.0];

    if (@available(iOS 13.0, *)) {
      UINavigationBarAppearance *appearance =
          [[UINavigationBarAppearance alloc] init];
      [appearance configureWithOpaqueBackground];
      appearance.backgroundColor = navBarColor;
      appearance.titleTextAttributes = @{
        NSForegroundColorAttributeName : [UIColor whiteColor],
        NSFontAttributeName : [UIFont systemFontOfSize:17
                                                weight:UIFontWeightSemibold]
      };

      self.navigationController.navigationBar.standardAppearance = appearance;
      self.navigationController.navigationBar.scrollEdgeAppearance = appearance;
      self.navigationController.navigationBar.compactAppearance = appearance;
    }

    self.navigationController.navigationBar.barTintColor = navBarColor;
    self.navigationController.navigationBar.translucent = NO;
    self.navigationController.navigationBar.tintColor = [UIColor whiteColor];
  }

  [self setupDetailView];
}

- (void)viewDidLayoutSubviews {
  [super viewDidLayoutSubviews];
  // No gradients to update - clean solid colors only
}

- (void)viewWillAppear:(BOOL)animated {
  [super viewWillAppear:animated];
  // Show navigation bar for detail view
  [self.navigationController setNavigationBarHidden:NO animated:animated];
}

- (void)setupDetailView {
  UIScrollView *scrollView = [[UIScrollView alloc] init];
  scrollView.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:scrollView];

  UIView *contentView = [[UIView alloc] init];
  contentView.translatesAutoresizingMaskIntoConstraints = NO;
  [scrollView addSubview:contentView];

  // Icon container - modern design with shadow
  UIView *iconContainer = [[UIView alloc] init];
  iconContainer.backgroundColor = [UIColor whiteColor];
  iconContainer.layer.cornerRadius = 18;
  iconContainer.layer.shadowColor = [UIColor blackColor].CGColor;
  iconContainer.layer.shadowOffset = CGSizeMake(0, 4);
  iconContainer.layer.shadowRadius = 10;
  iconContainer.layer.shadowOpacity = 0.3;
  iconContainer.translatesAutoresizingMaskIntoConstraints = NO;
  [contentView addSubview:iconContainer];

  // Icon view - load from URL or use SF Symbol
  UIImageView *iconView = [[UIImageView alloc] init];
  iconView.contentMode = UIViewContentModeScaleAspectFit;
  iconView.translatesAutoresizingMaskIntoConstraints = NO;
  [iconContainer addSubview:iconView];

  // Try to load from URL first, fallback to SF Symbol
  NSString *iconUrl = self.model[@"iconUrl"];
  if (iconUrl && iconUrl.length > 0) {
    [self loadImageFromURL:iconUrl forImageView:iconView];
  } else {
    // Fallback to SF Symbol
    UIImageSymbolConfiguration *iconConfig = [UIImageSymbolConfiguration
        configurationWithPointSize:40
                            weight:UIImageSymbolWeightRegular];
    UIImage *iconImage =
        [UIImage systemImageNamed:self.model[@"icon"] ?: @"sparkles"
                withConfiguration:iconConfig];
    iconView.image = iconImage;
    iconView.tintColor = [UIColor blackColor];
  }

  // Model name - elegant typography
  UILabel *nameLabel = [[UILabel alloc] init];
  nameLabel.text = self.model[@"name"];
  nameLabel.textColor = [UIColor whiteColor];
  nameLabel.font = [UIFont systemFontOfSize:28 weight:UIFontWeightBold];
  nameLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentView addSubview:nameLabel];

  // Tag badge - native iOS style
  NSString *tagText = self.model[@"tag"];
  UIButton *tagButton = nil;
  if (tagText) {
    tagButton = [UIButton buttonWithType:UIButtonTypeSystem];
    tagButton.translatesAutoresizingMaskIntoConstraints = NO;
    tagButton.userInteractionEnabled = NO; // Not interactive, just for display

    // Use native iOS button configuration (iOS 15+)
    if (@available(iOS 15.0, *)) {
      UIButtonConfiguration *tagConfig =
          [UIButtonConfiguration plainButtonConfiguration];
      tagConfig.title = tagText;
      tagConfig.baseForegroundColor = [UIColor whiteColor];
      tagConfig.background.backgroundColor = [UIColor colorWithWhite:0.25
                                                               alpha:1.0];
      tagConfig.background.cornerRadius = 12;
      tagConfig.contentInsets = NSDirectionalEdgeInsetsMake(6, 10, 6, 10);
      tagConfig.titleTextAttributesTransformer =
          ^NSDictionary<NSAttributedStringKey, id> *(
              NSDictionary<NSAttributedStringKey, id> *textAttributes) {
        NSMutableDictionary *newAttributes = [textAttributes mutableCopy];
        newAttributes[NSFontAttributeName] =
            [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
        return newAttributes;
      };
      tagButton.configuration = tagConfig;
    } else {
      // Fallback for older iOS
      [tagButton setTitle:tagText forState:UIControlStateNormal];
      [tagButton setTitleColor:[UIColor whiteColor]
                      forState:UIControlStateNormal];
      tagButton.backgroundColor = [UIColor colorWithWhite:0.25 alpha:1.0];
      tagButton.layer.cornerRadius = 12;
      tagButton.layer.masksToBounds = YES;
      tagButton.titleLabel.font =
          [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
      tagButton.contentEdgeInsets = UIEdgeInsetsMake(6, 10, 6, 10);
    }

    [contentView addSubview:tagButton];
  }

  // Description - improved typography with better line spacing
  UILabel *descriptionLabel = [[UILabel alloc] init];
  NSString *descriptionText = self.model[@"description"];
  NSMutableParagraphStyle *paragraphStyle =
      [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.lineSpacing = 6;
  paragraphStyle.lineHeightMultiple = 1.2;
  NSMutableAttributedString *attributedDescription =
      [[NSMutableAttributedString alloc] initWithString:descriptionText];
  [attributedDescription addAttribute:NSParagraphStyleAttributeName
                                value:paragraphStyle
                                range:NSMakeRange(0, descriptionText.length)];
  [attributedDescription addAttribute:NSForegroundColorAttributeName
                                value:[UIColor colorWithWhite:0.75 alpha:1.0]
                                range:NSMakeRange(0, descriptionText.length)];
  [attributedDescription
      addAttribute:NSFontAttributeName
             value:[UIFont systemFontOfSize:17 weight:UIFontWeightRegular]
             range:NSMakeRange(0, descriptionText.length)];
  descriptionLabel.attributedText = attributedDescription;
  descriptionLabel.numberOfLines = 0;
  descriptionLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [contentView addSubview:descriptionLabel];

  // Cost - elegant styling
  NSString *cost = self.model[@"cost"];
  UILabel *costLabel = nil;
  if (cost) {
    costLabel = [[UILabel alloc] init];
    NSString *costText =
        [NSString stringWithFormat:@"Average cost per request: $%@", cost];
    NSMutableAttributedString *attributedCost =
        [[NSMutableAttributedString alloc] initWithString:costText];
    [attributedCost addAttribute:NSForegroundColorAttributeName
                           value:[UIColor colorWithWhite:0.7 alpha:1.0]
                           range:NSMakeRange(0, costText.length)];
    [attributedCost
        addAttribute:NSForegroundColorAttributeName
               value:[UIColor whiteColor]
               range:[costText rangeOfString:[NSString stringWithFormat:@"$%@",
                                                                        cost]]];
    [attributedCost addAttribute:NSFontAttributeName
                           value:[UIFont systemFontOfSize:15
                                                   weight:UIFontWeightMedium]
                           range:NSMakeRange(0, costText.length)];
    [attributedCost
        addAttribute:NSFontAttributeName
               value:[UIFont systemFontOfSize:15 weight:UIFontWeightBold]
               range:[costText rangeOfString:[NSString stringWithFormat:@"$%@",
                                                                        cost]]];

    costLabel.attributedText = attributedCost;
    costLabel.translatesAutoresizingMaskIntoConstraints = NO;
    [contentView addSubview:costLabel];
  }

  // Constraints
  [NSLayoutConstraint activateConstraints:@[
    [scrollView.topAnchor
        constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor],
    [scrollView.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor],
    [scrollView.trailingAnchor
        constraintEqualToAnchor:self.view.trailingAnchor],
    [scrollView.bottomAnchor constraintEqualToAnchor:self.view.bottomAnchor],

    [contentView.topAnchor constraintEqualToAnchor:scrollView.topAnchor],
    [contentView.leadingAnchor
        constraintEqualToAnchor:scrollView.leadingAnchor],
    [contentView.trailingAnchor
        constraintEqualToAnchor:scrollView.trailingAnchor],
    [contentView.bottomAnchor constraintEqualToAnchor:scrollView.bottomAnchor],
    [contentView.widthAnchor constraintEqualToAnchor:scrollView.widthAnchor],

    [iconContainer.topAnchor constraintEqualToAnchor:contentView.topAnchor
                                            constant:32],
    [iconContainer.leadingAnchor
        constraintEqualToAnchor:contentView.leadingAnchor
                       constant:24],
    [iconContainer.widthAnchor constraintEqualToConstant:72],
    [iconContainer.heightAnchor constraintEqualToConstant:72],

    [iconView.centerXAnchor
        constraintEqualToAnchor:iconContainer.centerXAnchor],
    [iconView.centerYAnchor
        constraintEqualToAnchor:iconContainer.centerYAnchor],
    [iconView.widthAnchor constraintEqualToConstant:60],
    [iconView.heightAnchor constraintEqualToConstant:60],

    [nameLabel.topAnchor constraintEqualToAnchor:iconContainer.topAnchor],
    [nameLabel.leadingAnchor
        constraintEqualToAnchor:iconContainer.trailingAnchor
                       constant:18],
    [nameLabel.trailingAnchor
        constraintLessThanOrEqualToAnchor:contentView.trailingAnchor
                                 constant:-24]
  ]];

  if (tagButton) {
    [NSLayoutConstraint activateConstraints:@[
      [tagButton.topAnchor constraintEqualToAnchor:nameLabel.bottomAnchor
                                          constant:10],
      [tagButton.leadingAnchor
          constraintEqualToAnchor:iconContainer.trailingAnchor
                         constant:18],
      [tagButton.heightAnchor constraintGreaterThanOrEqualToConstant:26]
    ]];
  }

  UIView *topReference = tagButton ?: nameLabel;

  [NSLayoutConstraint activateConstraints:@[
    [descriptionLabel.topAnchor
        constraintEqualToAnchor:topReference.bottomAnchor
                       constant:32],
    [descriptionLabel.leadingAnchor
        constraintEqualToAnchor:contentView.leadingAnchor
                       constant:24],
    [descriptionLabel.trailingAnchor
        constraintEqualToAnchor:contentView.trailingAnchor
                       constant:-24]
  ]];

  if (costLabel) {
    [NSLayoutConstraint activateConstraints:@[
      [costLabel.topAnchor constraintEqualToAnchor:descriptionLabel.bottomAnchor
                                          constant:32],
      [costLabel.leadingAnchor constraintEqualToAnchor:contentView.leadingAnchor
                                              constant:24],
      [costLabel.trailingAnchor
          constraintEqualToAnchor:contentView.trailingAnchor
                         constant:-24],
      [costLabel.bottomAnchor constraintEqualToAnchor:contentView.bottomAnchor
                                             constant:-32]
    ]];
  } else {
    [NSLayoutConstraint
        activateConstraints:@[ [descriptionLabel.bottomAnchor
                                constraintEqualToAnchor:contentView.bottomAnchor
                                               constant:-32] ]];
  }
}

- (void)backButtonTapped:(UIBarButtonItem *)sender {
  if (self.navigationController &&
      self.navigationController.viewControllers.count > 1) {
    [self.navigationController popViewControllerAnimated:YES];
  } else {
    [self dismissViewControllerAnimated:YES completion:nil];
  }
}

@end
