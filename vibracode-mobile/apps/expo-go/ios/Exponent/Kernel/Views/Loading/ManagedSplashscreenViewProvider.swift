import UIKit
import React

@objc(EXManagedAppSplashScreenViewProvider)
class ManagedAppSplashscreenViewProvider: NSObject, SplashScreenViewProvider {
  var configuration: ManagedAppSplashScreenConfiguration?
  var splashScreenView: UIView?
  var splashImageView: UIImageView?
  var imageViewContainer: UIView?

  // Progress tracking components
  private var statusLabel: UILabel?
  private var percentageLabel: UILabel?
  private var contentStack: UIStackView?
  private var backgroundImageView: UIImageView?
  private var darkOverlayView: UIView?
  private var gradientOverlayView: UIView?
  private var gradientLayer: CAGradientLayer?
  private var taglineLabel: UILabel?

  // Minimal loader
  private var loaderDots: [UIView] = []

  // Progress state
  private var currentProgress: CGFloat = 0
  private var currentStatus: String = "Loading"
  private var isProgressVisible: Bool = false

  @objc init(with manifest: EXManifests.Manifest) {
    configuration = SplashScreenConfigurationBuilder.parse(manifest: manifest)
  }

  func createSplashScreenView() -> UIView {
    let view = UIView()
    view.backgroundColor = .black
    configureSplashScreenViewSync(for: view)
    splashScreenView = view
    return view
  }

  @objc func updateSplashScreenView(with manifest: EXManifests.Manifest) {
    let newConfiguration = SplashScreenConfigurationBuilder.parse(manifest: manifest)
    configuration = newConfiguration

    if let splashScreenView {
      // Update app name if changed
      if let nameLabel = contentStack?.arrangedSubviews.compactMap({ $0 as? UILabel }).first(where: { $0.tag == 100 }) {
        nameLabel.text = configuration?.appName ?? "Loading"
      }

      // Update icon if URL changed
      if let imageUrl = configuration?.imageUrl, let url = URL(string: imageUrl) {
        splashImageView?.sd_setImage(with: url)
      }
    }
  }

  // MARK: - Public Progress API

  @objc func updateProgress(_ progress: Float, status: String) {
    currentProgress = CGFloat(progress)
    currentStatus = status
    isProgressVisible = true

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.updateStatusText(status)
      self.updatePercentage(progress)
    }
  }

  @objc func hideProgress() {
    isProgressVisible = false

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseIn) {
        self.contentStack?.alpha = 0
      }
    }
  }

  @objc func isShowingProgress() -> Bool {
    return isProgressVisible && splashScreenView?.window != nil
  }

  // MARK: - Synchronous View Configuration

  private func configureSplashScreenViewSync(for view: UIView) {
    view.subviews.forEach { $0.removeFromSuperview() }
    view.layer.sublayers?.forEach { $0.removeFromSuperlayer() }
    loaderDots.removeAll()

    view.backgroundColor = .black

    addBackgroundImage(to: view)
    addDarkOverlay(to: view)
    addGradientOverlay(to: view)

    let stack = createContentStack(in: view)
    contentStack = stack

    if let imageUrl = configuration?.imageUrl {
      addAppIcon(imageUrl: imageUrl, to: stack)
    }

    addAppNameLabel(to: stack)
    addTagline(to: stack)
    addMinimalLoader(to: stack)
    addPercentageLabel(to: stack)
    addStatusLabel(to: stack)

    splashScreenView = view
  }

  // MARK: - Background Image

  private func addBackgroundImage(to view: UIView) {
    let imageView = UIImageView()
    imageView.translatesAutoresizingMaskIntoConstraints = false

    if let nativeImage = UIImage(named: "OnboardingWelcomeBg") {
      imageView.image = nativeImage
    }

    imageView.contentMode = .scaleAspectFill
    imageView.clipsToBounds = true

    view.addSubview(imageView)
    backgroundImageView = imageView

    NSLayoutConstraint.activate([
      imageView.topAnchor.constraint(equalTo: view.topAnchor),
      imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      imageView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
  }

  // MARK: - Dark Overlay

  private func addDarkOverlay(to view: UIView) {
    let overlay = UIView()
    overlay.translatesAutoresizingMaskIntoConstraints = false
    overlay.backgroundColor = UIColor.black.withAlphaComponent(0.55)
    overlay.isUserInteractionEnabled = false

    view.addSubview(overlay)
    darkOverlayView = overlay

    NSLayoutConstraint.activate([
      overlay.topAnchor.constraint(equalTo: view.topAnchor),
      overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
  }

  // MARK: - Gradient Overlay

  private func addGradientOverlay(to view: UIView) {
    let overlayView = UIView()
    overlayView.translatesAutoresizingMaskIntoConstraints = false
    overlayView.isUserInteractionEnabled = false
    view.addSubview(overlayView)
    gradientOverlayView = overlayView

    NSLayoutConstraint.activate([
      overlayView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      overlayView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      overlayView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      overlayView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.75)
    ])

    let gradient = CAGradientLayer()
    gradient.colors = [
      UIColor.clear.cgColor,
      UIColor.black.withAlphaComponent(0.4).cgColor,
      UIColor.black.withAlphaComponent(0.7).cgColor,
      UIColor.black.withAlphaComponent(0.95).cgColor,
      UIColor.black.cgColor
    ]
    gradient.locations = [0.0, 0.25, 0.5, 0.75, 1.0]
    gradient.startPoint = CGPoint(x: 0.5, y: 0)
    gradient.endPoint = CGPoint(x: 0.5, y: 1)
    overlayView.layer.addSublayer(gradient)
    gradientLayer = gradient

    overlayView.layer.addObserver(self, forKeyPath: "bounds", options: [.new, .initial], context: nil)
  }

  override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
    if keyPath == "bounds", let layer = object as? CALayer {
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      gradientLayer?.frame = layer.bounds
      CATransaction.commit()
    }
  }

  // MARK: - Content Stack

  private func createContentStack(in view: UIView) -> UIStackView {
    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.alignment = .center
    stack.spacing = 12
    stack.alpha = 0

    view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
    ])

    UIView.animate(withDuration: 0.6, delay: 0.05, options: .curveEaseOut) {
      stack.alpha = 1.0
    }

    return stack
  }

  // MARK: - App Icon

  private func addAppIcon(imageUrl: String, to stack: UIStackView) {
    let iconSize: CGFloat = 80

    let imageView = UIImageView()
    imageView.translatesAutoresizingMaskIntoConstraints = false

    if let url = URL(string: imageUrl) {
      imageView.sd_setImage(with: url)
    }

    imageView.contentMode = configuration?.imageResizeMode == .cover ? .scaleAspectFill : .scaleAspectFit
    imageView.layer.cornerRadius = 18
    imageView.clipsToBounds = true
    imageView.backgroundColor = UIColor.white.withAlphaComponent(0.03)
    splashImageView = imageView

    NSLayoutConstraint.activate([
      imageView.widthAnchor.constraint(equalToConstant: iconSize),
      imageView.heightAnchor.constraint(equalToConstant: iconSize)
    ])

    stack.addArrangedSubview(imageView)
    stack.setCustomSpacing(14, after: imageView)
  }

  // MARK: - App Name Label

  private func addAppNameLabel(to stack: UIStackView) {
    let nameLabel = UILabel()
    nameLabel.translatesAutoresizingMaskIntoConstraints = false
    nameLabel.text = configuration?.appName ?? "Loading"
    nameLabel.textAlignment = .center
    nameLabel.tag = 100  // For finding later

    // Use SF Pro Display with tight tracking for modern feel
    let fontSize: CGFloat = 26
    if let descriptor = UIFont.systemFont(ofSize: fontSize, weight: .bold).fontDescriptor.withDesign(.rounded) {
      nameLabel.font = UIFont(descriptor: descriptor, size: fontSize)
    } else {
      nameLabel.font = UIFont.systemFont(ofSize: fontSize, weight: .bold)
    }
    nameLabel.textColor = .white

    stack.addArrangedSubview(nameLabel)
    stack.setCustomSpacing(6, after: nameLabel)
  }

  // MARK: - Tagline with Mixed Typography

  private func addTagline(to stack: UIStackView) {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.textAlignment = .center
    label.numberOfLines = 1

    // Create attributed string: "Where imagination builds"
    // "imagination" in italic serif (New York), rest in light sans-serif
    let fullText = "Where imagination builds"
    let attributedString = NSMutableAttributedString(string: fullText)

    // Base style: Light, elegant sans-serif
    let baseFont = UIFont.systemFont(ofSize: 15, weight: .light)
    let baseColor = UIColor.white.withAlphaComponent(0.6)
    attributedString.addAttribute(.font, value: baseFont, range: NSRange(location: 0, length: fullText.count))
    attributedString.addAttribute(.foregroundColor, value: baseColor, range: NSRange(location: 0, length: fullText.count))

    // Letter spacing for elegance
    attributedString.addAttribute(.kern, value: 0.5, range: NSRange(location: 0, length: fullText.count))

    // "imagination" in New York italic (Apple's serif font)
    if let imaginationRange = fullText.range(of: "imagination") {
      let nsRange = NSRange(imaginationRange, in: fullText)

      // Try New York italic, fall back to serif italic
      if let nyDescriptor = UIFontDescriptor(fontAttributes: [
        .family: "New York",
        .traits: [UIFontDescriptor.TraitKey.symbolic: UIFontDescriptor.SymbolicTraits.traitItalic.rawValue]
      ]).withDesign(.serif) {
        let nyFont = UIFont(descriptor: nyDescriptor, size: 15)
        attributedString.addAttribute(.font, value: nyFont, range: nsRange)
      } else if let serifDescriptor = UIFont.systemFont(ofSize: 15, weight: .regular).fontDescriptor.withDesign(.serif) {
        let serifFont = UIFont(descriptor: serifDescriptor.withSymbolicTraits(.traitItalic) ?? serifDescriptor, size: 15)
        attributedString.addAttribute(.font, value: serifFont, range: nsRange)
      }

      // Slightly brighter for emphasis
      attributedString.addAttribute(.foregroundColor, value: UIColor.white.withAlphaComponent(0.75), range: nsRange)
    }

    label.attributedText = attributedString
    taglineLabel = label

    stack.addArrangedSubview(label)
    stack.setCustomSpacing(28, after: label)
  }

  // MARK: - Minimal Loader

  private func addMinimalLoader(to stack: UIStackView) {
    let dotsStack = UIStackView()
    dotsStack.translatesAutoresizingMaskIntoConstraints = false
    dotsStack.axis = .horizontal
    dotsStack.alignment = .center
    dotsStack.spacing = 6
    dotsStack.distribution = .equalSpacing

    let dotSize: CGFloat = 3

    for _ in 0..<3 {
      let dot = UIView()
      dot.translatesAutoresizingMaskIntoConstraints = false
      dot.backgroundColor = UIColor.white.withAlphaComponent(0.4)
      dot.layer.cornerRadius = dotSize / 2

      NSLayoutConstraint.activate([
        dot.widthAnchor.constraint(equalToConstant: dotSize),
        dot.heightAnchor.constraint(equalToConstant: dotSize)
      ])

      dotsStack.addArrangedSubview(dot)
      loaderDots.append(dot)
    }

    stack.addArrangedSubview(dotsStack)
    stack.setCustomSpacing(16, after: dotsStack)

    startSubtleAnimation()
  }

  private func startSubtleAnimation() {
    for (index, dot) in loaderDots.enumerated() {
      let delay = Double(index) * 0.15

      let opacityAnimation = CAKeyframeAnimation(keyPath: "opacity")
      opacityAnimation.values = [0.25, 0.7, 0.25]
      opacityAnimation.keyTimes = [0, 0.5, 1.0]
      opacityAnimation.duration = 1.0
      opacityAnimation.repeatCount = .infinity
      opacityAnimation.beginTime = CACurrentMediaTime() + delay
      opacityAnimation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

      dot.layer.add(opacityAnimation, forKey: "opacity")
    }
  }

  // MARK: - Percentage Label

  private func addPercentageLabel(to stack: UIStackView) {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.text = "0%"
    label.font = UIFont.monospacedDigitSystemFont(ofSize: 13, weight: .regular)
    label.textColor = UIColor.white.withAlphaComponent(0.5)
    label.textAlignment = .center

    stack.addArrangedSubview(label)
    stack.setCustomSpacing(6, after: label)
    percentageLabel = label
  }

  // MARK: - Status Label

  private func addStatusLabel(to stack: UIStackView) {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.font = UIFont.systemFont(ofSize: 10, weight: .medium)
    label.textColor = UIColor.white.withAlphaComponent(0.35)
    label.textAlignment = .center

    let attributedString = NSMutableAttributedString(string: "LOADING")
    attributedString.addAttribute(.kern, value: 2.5, range: NSRange(location: 0, length: attributedString.length))
    label.attributedText = attributedString

    stack.addArrangedSubview(label)
    statusLabel = label

    // Add subtle pulse shimmer to status label
    startStatusShimmer()
  }

  // MARK: - Shimmer Animation for Status

  private func startStatusShimmer() {
    guard let label = statusLabel else { return }

    // Simple opacity pulse that creates a shimmer-like effect
    let pulseAnimation = CAKeyframeAnimation(keyPath: "opacity")
    pulseAnimation.values = [0.35, 0.6, 0.35]
    pulseAnimation.keyTimes = [0, 0.5, 1.0]
    pulseAnimation.duration = 2.0
    pulseAnimation.repeatCount = .infinity
    pulseAnimation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

    label.layer.add(pulseAnimation, forKey: "shimmer")
  }

  private func updatePercentage(_ progress: Float) {
    let percentage = Int(progress * 100)
    percentageLabel?.text = "\(percentage)%"
  }

  private func updateStatusText(_ status: String) {
    guard let label = statusLabel else { return }

    var displayText: String
    if status.lowercased().contains("download") {
      displayText = "DOWNLOADING"
    } else if status.lowercased().contains("build") || status.lowercased().contains("bundl") {
      displayText = "BUNDLING"
    } else if status.lowercased().contains("start") {
      displayText = "STARTING"
    } else if status.lowercased().contains("load") {
      displayText = "LOADING"
    } else if status.lowercased().contains("check") {
      displayText = "CHECKING"
    } else {
      displayText = status.uppercased()
    }

    let currentText = (label.attributedText?.string ?? "")
    if currentText != displayText {
      let attributedString = NSMutableAttributedString(string: displayText)
      attributedString.addAttribute(.kern, value: 2.5, range: NSRange(location: 0, length: attributedString.length))
      label.attributedText = attributedString
    }
  }

  deinit {
    gradientOverlayView?.layer.removeObserver(self, forKeyPath: "bounds")
  }
}
