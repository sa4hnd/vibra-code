// Copyright 2015-present 650 Industries. All rights reserved.

import UIKit
import Lottie

// MARK: - Cell Animation Style Enum

/// Animation style for cell appearance - exposed to ObjC
/// Must be at top level for proper ObjC bridging
@objc public enum EXCellAnimationStyle: Int {
    case fadeIn = 0       // Simple fade
    case slideUp = 1      // Slide from bottom with fade
    case scaleIn = 2      // Scale from 0.95 with fade
    case springIn = 3     // Spring scale (iOS 26 style)
}

// MARK: - Cell Appearance Animation Helper

/// Provides smooth, HIG-compliant animations for new cells appearing
/// Uses spring animations matching iOS system behavior
/// IMPORTANT: Respects "Reduce Motion" accessibility setting (HIG requirement)
@objc(EXCellAnimationHelper)
public class EXCellAnimationHelper: NSObject {

    /// Global flag to disable cell appearance animations during initial load
    /// Set to false before initial load, true after scroll position is set
    @objc public static var animationsEnabled: Bool = true

    /// Check if user has enabled Reduce Motion (HIG: always respect this)
    @objc public static var reduceMotionEnabled: Bool {
        return UIAccessibility.isReduceMotionEnabled
    }

    /// Prepare a node for appear animation (call before animation)
    @objc public static func prepareForAppearAnimation(_ view: UIView, style: EXCellAnimationStyle = .springIn) {
        // Skip all animation prep if animations disabled (initial load)
        if !animationsEnabled {
            view.alpha = 1
            view.transform = .identity
            return
        }

        // HIG: Respect Reduce Motion - skip transform preparation
        if reduceMotionEnabled {
            view.alpha = 0
            return
        }

        view.alpha = 0

        switch style {
        case .fadeIn:
            break // Just alpha
        case .slideUp:
            view.transform = CGAffineTransform(translationX: 0, y: 20)
        case .scaleIn:
            view.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
        case .springIn:
            view.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
                .concatenating(CGAffineTransform(translationX: 0, y: 8))
        }
    }

    /// Animate a node's appearance (call in didEnterVisibleState)
    /// HIG: Animation duration under 0.3s, respects Reduce Motion
    @objc public static func animateAppearance(
        _ view: UIView,
        style: EXCellAnimationStyle = .springIn,
        delay: TimeInterval = 0,
        completion: (() -> Void)? = nil
    ) {
        // Skip animation if disabled (initial load) - just show immediately
        if !animationsEnabled {
            view.alpha = 1
            view.transform = .identity
            completion?()
            return
        }

        // HIG: Respect Reduce Motion - use simple crossfade only
        if reduceMotionEnabled {
            UIView.animate(
                withDuration: 0.2,
                delay: delay,
                options: [.allowUserInteraction, .curveEaseOut]
            ) {
                view.alpha = 1
                view.transform = .identity
            } completion: { _ in
                completion?()
            }
            return
        }

        // iOS 17+ uses modern spring animation API
        if #available(iOS 17.0, *) {
            UIView.animate(
                springDuration: 0.5,
                bounce: 0.15,
                initialSpringVelocity: 0.5,
                delay: delay,
                options: [.allowUserInteraction, .beginFromCurrentState]
            ) {
                view.alpha = 1
                view.transform = .identity
            } completion: { _ in
                completion?()
            }
        } else {
            // Fallback spring animation for older iOS
            UIView.animate(
                withDuration: 0.45,
                delay: delay,
                usingSpringWithDamping: 0.8,
                initialSpringVelocity: 0.5,
                options: [.allowUserInteraction, .beginFromCurrentState]
            ) {
                view.alpha = 1
                view.transform = .identity
            } completion: { _ in
                completion?()
            }
        }
    }

    /// Convenience method for simple fade in (HIG: under 0.3s)
    @objc public static func fadeIn(_ view: UIView, duration: TimeInterval = 0.25, delay: TimeInterval = 0) {
        view.alpha = 0
        UIView.animate(
            withDuration: reduceMotionEnabled ? 0.15 : duration,
            delay: delay,
            options: [.allowUserInteraction, .curveEaseOut]
        ) {
            view.alpha = 1
        }
    }

    /// Animate exit (for removal)
    @objc public static func animateExit(
        _ view: UIView,
        style: EXCellAnimationStyle = .fadeIn,
        completion: (() -> Void)? = nil
    ) {
        // HIG: Respect Reduce Motion
        if reduceMotionEnabled {
            UIView.animate(
                withDuration: 0.15,
                delay: 0,
                options: [.allowUserInteraction, .curveEaseIn]
            ) {
                view.alpha = 0
            } completion: { _ in
                completion?()
            }
            return
        }

        UIView.animate(
            withDuration: 0.2,
            delay: 0,
            options: [.allowUserInteraction, .curveEaseIn]
        ) {
            view.alpha = 0
            if style == .slideUp {
                view.transform = CGAffineTransform(translationX: 0, y: -10)
            } else if style == .scaleIn || style == .springIn {
                view.transform = CGAffineTransform(scaleX: 0.98, y: 0.98)
            }
        } completion: { _ in
            completion?()
        }
    }
}

/// Objective-C compatible wrapper for Lottie animations
@objc(EXLottieAnimationHelper)
public class EXLottieAnimationHelper: NSObject {

    /// Create a Lottie animation view with the given animation name
    @objc public static func createAnimationView(named name: String) -> UIView {
        let animationView = LottieAnimationView(name: name)
        animationView.loopMode = .loop
        animationView.contentMode = .scaleAspectFit
        return animationView
    }

    /// Create a Lottie animation view with the given animation name and content mode
    @objc public static func createAnimationView(named name: String, contentMode: UIView.ContentMode) -> UIView {
        let animationView = LottieAnimationView(name: name)
        animationView.loopMode = .loop
        animationView.contentMode = contentMode
        return animationView
    }

    /// Play the animation on a Lottie view
    @objc public static func play(_ view: UIView) {
        if let animationView = view as? LottieAnimationView {
            animationView.play()
        }
    }

    /// Stop the animation on a Lottie view
    @objc public static func stop(_ view: UIView) {
        if let animationView = view as? LottieAnimationView {
            animationView.stop()
        }
    }

    /// Set loop mode to loop forever
    @objc public static func setLoopMode(_ view: UIView, loop: Bool) {
        if let animationView = view as? LottieAnimationView {
            animationView.loopMode = loop ? .loop : .playOnce
        }
    }

    /// Check if animation is currently playing
    @objc public static func isPlaying(_ view: UIView) -> Bool {
        if let animationView = view as? LottieAnimationView {
            return animationView.isAnimationPlaying
        }
        return false
    }
}

// MARK: - Text Shimmer Effect Helper

/// High-performance text shimmer effect
/// Creates a subtle pulsing/breathing animation without masking/hiding text
@objc(EXTextShimmerHelper)
public class EXTextShimmerHelper: NSObject {

    private static var shimmerLayers: [ObjectIdentifier: CALayer] = [:]
    private static let shimmerAnimationKey = "shimmerPulseAnimation"

    /// Apply shimmer effect to a label - subtle opacity pulse
    @objc public static func applyShimmer(to label: UILabel, duration: CFTimeInterval = 1.5) {
        // Remove any existing shimmer
        removeShimmer(from: label)

        // Create a subtle opacity pulse animation
        let animation = CABasicAnimation(keyPath: "opacity")
        animation.fromValue = 0.5
        animation.toValue = 1.0
        animation.duration = duration / 2
        animation.autoreverses = true
        animation.repeatCount = .infinity
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

        label.layer.add(animation, forKey: shimmerAnimationKey)

        // Store reference for cleanup (using a dummy layer as marker)
        let markerLayer = CALayer()
        shimmerLayers[ObjectIdentifier(label)] = markerLayer
    }

    /// Apply shimmer to any UIView (including ASTextNode's view)
    @objc public static func applyShimmerToTextNode(_ view: UIView, duration: CFTimeInterval = 1.5) {
        // First try to find a UILabel (traditional approach)
        if let label = findLabel(in: view) {
            applyShimmer(to: label, duration: duration)
            return
        }

        // For ASTextNode or other views without UILabel, apply shimmer directly to the view
        applyShimmerToView(view, duration: duration)
    }

    /// Apply shimmer effect directly to any view - subtle opacity pulse
    @objc public static func applyShimmerToView(_ view: UIView, duration: CFTimeInterval = 1.5) {
        // Remove any existing shimmer
        removeShimmerFromView(view)

        // Create a subtle opacity pulse animation
        let animation = CABasicAnimation(keyPath: "opacity")
        animation.fromValue = 0.5
        animation.toValue = 1.0
        animation.duration = duration / 2
        animation.autoreverses = true
        animation.repeatCount = .infinity
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

        view.layer.add(animation, forKey: shimmerAnimationKey)

        // Store reference for cleanup (using a dummy layer as marker)
        let markerLayer = CALayer()
        shimmerLayers[ObjectIdentifier(view)] = markerLayer
    }

    /// Remove shimmer effect from a label
    @objc public static func removeShimmer(from label: UILabel) {
        let id = ObjectIdentifier(label)
        shimmerLayers.removeValue(forKey: id)
        label.layer.removeAnimation(forKey: shimmerAnimationKey)
        label.layer.mask = nil
        label.layer.opacity = 1.0
    }

    /// Remove shimmer from ASTextNode view
    @objc public static func removeShimmerFromTextNode(_ view: UIView) {
        // Try finding a label first
        if let label = findLabel(in: view) {
            removeShimmer(from: label)
            return
        }
        // Otherwise remove directly from view
        removeShimmerFromView(view)
    }

    /// Remove shimmer effect from any view
    @objc public static func removeShimmerFromView(_ view: UIView) {
        let id = ObjectIdentifier(view)
        shimmerLayers.removeValue(forKey: id)
        view.layer.removeAnimation(forKey: shimmerAnimationKey)
        view.layer.mask = nil
        view.layer.opacity = 1.0
    }

    /// Update shimmer layer frame when label bounds change
    @objc public static func updateShimmerFrame(for label: UILabel) {
        // No-op for opacity-based shimmer (no frame to update)
    }

    /// Find UILabel in view hierarchy (for ASTextNode)
    private static func findLabel(in view: UIView) -> UILabel? {
        if let label = view as? UILabel {
            return label
        }
        for subview in view.subviews {
            if let label = findLabel(in: subview) {
                return label
            }
        }
        return nil
    }
}

// MARK: - Glass Effect Helper for iOS 26+

/// Helper for creating iOS 26 Liquid Glass effects with fallback
/// Following Apple HIG: Use Regular variant for navigation layer elements
/// Clear variant only when ALL conditions met: media-rich background, dimming acceptable, bold content
@objc(EXGlassEffectHelper)
public class EXGlassEffectHelper: NSObject {

    /// Glass effect style matching UIGlassEffect.Style
    @objc public enum GlassStyle: Int {
        case regular = 0  // Default - full adaptive behavior, use 95% of cases
        case clear = 1    // More transparent, requires dimming layer
    }

    /// Check if Liquid Glass is available (iOS 26+)
    @objc public static func isLiquidGlassAvailable() -> Bool {
        if #available(iOS 26.0, *) {
            return true
        }
        return false
    }

    /// Create a visual effect view with Liquid Glass (iOS 26+) or blur fallback
    /// - Parameters:
    ///   - style: Glass style (.regular or .clear) - use .regular for most cases
    ///   - interactive: Whether the glass effect should be interactive (for buttons/controls)
    ///   - cornerRadius: Corner radius for the effect view
    ///   - tintColor: Optional tint color for the glass (use sparingly for primary actions)
    /// - Returns: UIVisualEffectView with appropriate effect
    @objc public static func createGlassEffectView(
        style: GlassStyle = .regular,
        interactive: Bool = false,
        cornerRadius: CGFloat = 16,
        tintColor: UIColor? = nil
    ) -> UIVisualEffectView {
        var effect: UIVisualEffect?

        if #available(iOS 26.0, *) {
            // Use UIGlassEffect directly with proper API
            let glassEffect = UIGlassEffect(style: style == .regular ? .regular : .clear)
            glassEffect.isInteractive = interactive

            if let tint = tintColor {
                glassEffect.tintColor = tint
            }

            effect = glassEffect
        }

        // Fallback to blur effect for iOS < 26
        if effect == nil {
            effect = UIBlurEffect(style: .systemMaterialDark)
        }

        let effectView = UIVisualEffectView(effect: effect)
        effectView.layer.cornerRadius = cornerRadius
        effectView.layer.cornerCurve = .continuous
        effectView.clipsToBounds = true

        return effectView
    }

    /// Legacy method for backward compatibility
    @objc public static func createGlassEffectView(
        interactive: Bool = false,
        cornerRadius: CGFloat = 16
    ) -> UIVisualEffectView {
        return createGlassEffectView(style: .regular, interactive: interactive, cornerRadius: cornerRadius, tintColor: nil)
    }

    /// Apply Liquid Glass effect to an existing view (iOS 26+) or blur fallback
    /// - Parameters:
    ///   - view: The view to apply the glass effect to
    ///   - style: Glass style (.regular or .clear)
    ///   - cornerRadius: Corner radius for the effect
    ///   - isInteractive: Whether the glass should respond to touches
    ///   - tintColor: Optional tint color
    @objc public static func applyGlassEffectToView(
        _ view: UIView,
        style: GlassStyle = .regular,
        cornerRadius: CGFloat = 16,
        isInteractive: Bool = false,
        tintColor: UIColor? = nil
    ) {
        let effectView = createGlassEffectView(
            style: style,
            interactive: isInteractive,
            cornerRadius: cornerRadius,
            tintColor: tintColor
        )
        effectView.frame = view.bounds
        effectView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.insertSubview(effectView, at: 0)

        // Also set the container's corner radius with continuous curve (HIG)
        view.layer.cornerRadius = cornerRadius
        view.layer.cornerCurve = .continuous
    }

    /// Legacy method for backward compatibility
    @objc public static func applyGlassEffectToView(
        _ view: UIView,
        cornerRadius: CGFloat = 16,
        isInteractive: Bool = false
    ) {
        applyGlassEffectToView(view, style: .regular, cornerRadius: cornerRadius, isInteractive: isInteractive, tintColor: nil)
    }
}
