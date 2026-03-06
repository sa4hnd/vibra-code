// Copyright 2015-present 650 Industries. All rights reserved.

import UIKit

/// Swift helper for markdown parsing
/// Provides custom markdown rendering without external dependencies
/// Handles: **bold**, *italic*, `code`, ```code blocks```, [links](url), ~~strikethrough~~, headers, lists, file paths
@objc(EXMarkdownHelper)
public class EXMarkdownHelper: NSObject {

  // MARK: - Color Palette (Apple HIG compliant, dark mode optimized)

  /// Mint green for code blocks - easy on the eyes, high contrast
  private static let codeBlockColor = UIColor(red: 0.4, green: 0.85, blue: 0.55, alpha: 1.0)

  /// Cyan/teal for file paths - distinct from regular text
  private static let filePathColor = UIColor(red: 0.45, green: 0.78, blue: 0.9, alpha: 1.0)

  /// Blue for links - standard link color
  private static let linkColor = UIColor(red: 0.4, green: 0.65, blue: 1.0, alpha: 1.0)

  /// Orange/amber for inline code - stands out from regular text
  private static let inlineCodeColor = UIColor(red: 0.95, green: 0.6, blue: 0.3, alpha: 1.0)

  /// Purple for media tags (image, video, audio) - distinct from other elements
  private static let mediaTagColor = UIColor(red: 0.7, green: 0.5, blue: 0.95, alpha: 1.0)

  /// Media tag background - subtle purple tint
  private static let mediaTagBackgroundColor = UIColor(red: 0.35, green: 0.25, blue: 0.5, alpha: 0.4)

  /// Background for code blocks and inline code
  private static let codeBackgroundColor = UIColor(white: 0.15, alpha: 0.95)

  // MARK: - File Path Patterns

  /// Regex patterns for detecting file paths
  private static let filePathPatterns: [String] = [
    // Unix-style paths: /path/to/file, ./path/to/file, ../path/to/file
    "(?:^|\\s)(/(?:[\\w.-]+/)*[\\w.-]+(?:\\.[a-zA-Z0-9]+)?)",
    "(?:^|\\s)(\\.\\.?/(?:[\\w.-]+/)*[\\w.-]+(?:\\.[a-zA-Z0-9]+)?)",

    // Common file extensions with optional path
    "(?:^|\\s|`)([\\w./\\-]+\\.(?:swift|ts|tsx|js|jsx|json|yml|yaml|md|txt|py|rb|go|rs|java|kt|m|mm|h|c|cpp|css|scss|html|xml|sh|bash|zsh|env|config|lock|toml|gradle|plist))",

    // Package paths: package.json, src/components/Button.tsx, etc.
    "(?:^|\\s)([a-z][\\w.-]*(?:/[\\w.-]+)+(?:\\.[a-z]+)?)",
  ]

  // MARK: - Public API

  /// Parse markdown string to attributed string
  /// - Parameters:
  ///   - markdown: The markdown string to parse
  /// - Returns: NSAttributedString with parsed markdown
  @objc public static func parseMarkdown(_ markdown: String) -> NSAttributedString? {
    return parseMarkdown(
      markdown,
      textColor: .white,
      codeBackgroundColor: codeBackgroundColor,
      codeTextColor: codeBlockColor
    )
  }

  /// Parse markdown with custom styling options
  /// - Parameters:
  ///   - markdown: The markdown string to parse
  ///   - textColor: The default text color
  ///   - codeBackgroundColor: Background color for code blocks
  ///   - codeTextColor: Text color for code blocks
  /// - Returns: Styled NSAttributedString
  @objc public static func parseMarkdown(
    _ markdown: String,
    textColor: UIColor,
    codeBackgroundColor: UIColor,
    codeTextColor: UIColor
  ) -> NSAttributedString? {
    guard !markdown.isEmpty else {
      return NSAttributedString(string: "")
    }

    // Font definitions - SF Pro system fonts per Apple HIG
    let baseFont = UIFont.systemFont(ofSize: 15, weight: .regular)
    let boldFont = UIFont.systemFont(ofSize: 15, weight: .semibold)
    let italicFont = UIFont.italicSystemFont(ofSize: 15)
    let codeFont = UIFont.monospacedSystemFont(ofSize: 13, weight: .regular)

    // Header fonts - scaled appropriately
    let h1Font = UIFont.systemFont(ofSize: 20, weight: .bold)
    let h2Font = UIFont.systemFont(ofSize: 17, weight: .semibold)
    let h3Font = UIFont.systemFont(ofSize: 15, weight: .medium)

    // Paragraph style for better readability
    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.lineSpacing = 4
    paragraphStyle.paragraphSpacing = 8

    let result = NSMutableAttributedString()
    var text = markdown

    // Process code blocks first (```...```)
    let codeBlockPattern = "```[\\s\\S]*?```"
    if let regex = try? NSRegularExpression(pattern: codeBlockPattern, options: []) {
      var lastEnd = text.startIndex
      let matches = regex.matches(in: text, options: [], range: NSRange(text.startIndex..., in: text))

      for match in matches {
        guard let range = Range(match.range, in: text) else { continue }

        // Add text before code block
        if lastEnd < range.lowerBound {
          let beforeText = String(text[lastEnd..<range.lowerBound])
          result.append(parseInlineMarkdown(
            beforeText,
            textColor: textColor,
            boldFont: boldFont,
            italicFont: italicFont,
            codeFont: codeFont,
            codeBackgroundColor: codeBackgroundColor,
            codeTextColor: codeTextColor,
            baseFont: baseFont,
            h1Font: h1Font,
            h2Font: h2Font,
            h3Font: h3Font,
            paragraphStyle: paragraphStyle
          ))
        }

        // Add code block with enhanced styling
        var codeContent = String(text[range])
        // Remove ``` markers and optional language identifier
        codeContent = codeContent.replacingOccurrences(of: "```\\w*\\n?", with: "", options: .regularExpression)
        codeContent = codeContent.replacingOccurrences(of: "```", with: "")
        codeContent = codeContent.trimmingCharacters(in: .whitespacesAndNewlines)

        // Code block paragraph style with tighter line spacing
        let codeParaStyle = NSMutableParagraphStyle()
        codeParaStyle.lineSpacing = 2

        let codeAttrs: [NSAttributedString.Key: Any] = [
          .font: codeFont,
          .foregroundColor: codeTextColor,
          .backgroundColor: codeBackgroundColor,
          .paragraphStyle: codeParaStyle
        ]

        // Add visual separation with padding
        result.append(NSAttributedString(string: "\n", attributes: [
          .font: UIFont.systemFont(ofSize: 6),
          .foregroundColor: UIColor.clear
        ]))
        result.append(NSAttributedString(string: codeContent, attributes: codeAttrs))
        result.append(NSAttributedString(string: "\n", attributes: [
          .font: UIFont.systemFont(ofSize: 6),
          .foregroundColor: UIColor.clear
        ]))

        lastEnd = range.upperBound
      }

      // Add remaining text
      if lastEnd < text.endIndex {
        let remainingText = String(text[lastEnd...])
        result.append(parseInlineMarkdown(
          remainingText,
          textColor: textColor,
          boldFont: boldFont,
          italicFont: italicFont,
          codeFont: codeFont,
          codeBackgroundColor: codeBackgroundColor,
          codeTextColor: codeTextColor,
          baseFont: baseFont,
          h1Font: h1Font,
          h2Font: h2Font,
          h3Font: h3Font,
          paragraphStyle: paragraphStyle
        ))
      }

      if !matches.isEmpty {
        return result
      }
    }

    // No code blocks, parse inline markdown
    return parseInlineMarkdown(
      text,
      textColor: textColor,
      boldFont: boldFont,
      italicFont: italicFont,
      codeFont: codeFont,
      codeBackgroundColor: codeBackgroundColor,
      codeTextColor: codeTextColor,
      baseFont: baseFont,
      h1Font: h1Font,
      h2Font: h2Font,
      h3Font: h3Font,
      paragraphStyle: paragraphStyle
    )
  }

  // MARK: - Private Methods

  private static func parseInlineMarkdown(
    _ text: String,
    textColor: UIColor,
    boldFont: UIFont,
    italicFont: UIFont,
    codeFont: UIFont,
    codeBackgroundColor: UIColor,
    codeTextColor: UIColor,
    baseFont: UIFont,
    h1Font: UIFont,
    h2Font: UIFont,
    h3Font: UIFont,
    paragraphStyle: NSParagraphStyle
  ) -> NSAttributedString {
    // Pre-process headers and lists by line
    var processedText = ""
    let lines = text.components(separatedBy: "\n")

    for (index, line) in lines.enumerated() {
      var processedLine = line

      // Process headers (### Header) - preserve original markers for styling
      if line.hasPrefix("### ") {
        processedLine = "⦁ " + String(line.dropFirst(4))
      } else if line.hasPrefix("## ") {
        processedLine = "◆ " + String(line.dropFirst(3))
      } else if line.hasPrefix("# ") {
        processedLine = "■ " + String(line.dropFirst(2))
      }
      // Process bullet lists (- item or * item)
      else if line.trimmingCharacters(in: .whitespaces).hasPrefix("- ") ||
              line.trimmingCharacters(in: .whitespaces).hasPrefix("* ") {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        processedLine = "  • " + String(trimmed.dropFirst(2))
      }
      // Process numbered lists (1. item)
      else if let regex = try? NSRegularExpression(pattern: "^\\s*\\d+\\.\\s+", options: []),
              let match = regex.firstMatch(in: line, options: [], range: NSRange(line.startIndex..., in: line)),
              let range = Range(match.range, in: line) {
        processedLine = "  " + String(line[range.upperBound...])
      }

      processedText += processedLine
      if index < lines.count - 1 {
        processedText += "\n"
      }
    }

    let result = NSMutableAttributedString(string: processedText, attributes: [
      .font: baseFont,
      .foregroundColor: textColor,
      .paragraphStyle: paragraphStyle
    ])

    // Process inline code (`code`) with orange color
    applyPattern("`([^`]+)`", to: result, attributes: [
      .font: codeFont,
      .foregroundColor: inlineCodeColor,
      .backgroundColor: codeBackgroundColor.withAlphaComponent(0.5)
    ])

    // Process bold (**text** or __text__)
    applyPattern("\\*\\*([^*]+)\\*\\*", to: result, attributes: [
      .font: boldFont
    ])
    applyPattern("__([^_]+)__", to: result, attributes: [
      .font: boldFont
    ])

    // Process italic (*text* or _text_) - be careful not to match **
    applyPattern("(?<!\\*)\\*([^*]+)\\*(?!\\*)", to: result, attributes: [
      .font: italicFont
    ])
    applyPattern("(?<!_)_([^_]+)_(?!_)", to: result, attributes: [
      .font: italicFont
    ])

    // Process strikethrough (~~text~~)
    applyPattern("~~([^~]+)~~", to: result, attributes: [
      .strikethroughStyle: NSUnderlineStyle.single.rawValue,
      .foregroundColor: textColor.withAlphaComponent(0.5)
    ])

    // Process links [text](url)
    applyLinkPattern(to: result, textColor: linkColor)

    // Process media tags [image: tagName], [video: tagName], [audio: tagName]
    applyMediaTagStyling(to: result, codeFont: codeFont)

    // Apply header styling for processed markers
    applyHeaderMarkers(to: result, h1Font: h1Font, h2Font: h2Font, h3Font: h3Font, textColor: textColor)

    // Apply file path styling - do this LAST to avoid conflicts with inline code
    applyFilePathStyling(to: result, codeFont: codeFont)

    return result
  }

  private static func applyHeaderMarkers(
    to attributedString: NSMutableAttributedString,
    h1Font: UIFont,
    h2Font: UIFont,
    h3Font: UIFont,
    textColor: UIColor
  ) {
    let text = attributedString.string

    // H1 style (■) - largest, bold
    if let regex = try? NSRegularExpression(pattern: "■ [^\n]+", options: []) {
      let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
      for match in matches {
        attributedString.addAttributes([
          .font: h1Font,
          .foregroundColor: UIColor.white
        ], range: match.range)
      }
    }

    // H2 style (◆) - medium, semibold
    if let regex = try? NSRegularExpression(pattern: "◆ [^\n]+", options: []) {
      let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
      for match in matches {
        attributedString.addAttributes([
          .font: h2Font,
          .foregroundColor: UIColor.white
        ], range: match.range)
      }
    }

    // H3 style (⦁) - small, medium weight
    if let regex = try? NSRegularExpression(pattern: "⦁ [^\n]+", options: []) {
      let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
      for match in matches {
        attributedString.addAttributes([
          .font: h3Font,
          .foregroundColor: UIColor.white.withAlphaComponent(0.9)
        ], range: match.range)
      }
    }
  }

  private static func applyFilePathStyling(to attributedString: NSMutableAttributedString, codeFont: UIFont) {
    let text = attributedString.string

    // Combined pattern for file paths
    // Matches: /path/to/file.ext, ./relative/path, file.swift, src/components/Button.tsx
    let pathPatterns = [
      // Absolute Unix paths starting with /
      "(?<=\\s|^|\\(|\\[|\"|\\'|:)(/[\\w.-]+(?:/[\\w.-]+)*)",

      // Relative paths starting with ./ or ../
      "(?<=\\s|^|\\(|\\[|\"|\\'|:)(\\.\\.?/[\\w.-]+(?:/[\\w.-]+)*)",

      // Files with common extensions (not inside backticks - those are handled by inline code)
      "(?<=\\s|^|\\(|\\[|\"|\\'|:)([\\w-]+(?:/[\\w.-]+)*\\.(?:swift|ts|tsx|js|jsx|json|yml|yaml|md|txt|py|rb|go|rs|java|kt|m|mm|h|c|cpp|css|scss|html|xml|sh|bash|zsh|env|config|lock|toml|gradle|plist|strings|xcconfig|xcodeproj|xcworkspace|entitlements|xcassets|storyboard|xib))",
    ]

    for pattern in pathPatterns {
      guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { continue }

      let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))

      for match in matches {
        // Get the capture group (the actual path, not the lookbehind)
        let captureRange = match.numberOfRanges > 1 ? match.range(at: 1) : match.range

        // Skip if already styled (inside code block or inline code)
        var existingAttrs = attributedString.attributes(at: captureRange.location, effectiveRange: nil)
        if let bgColor = existingAttrs[.backgroundColor] as? UIColor,
           bgColor != UIColor.clear {
          continue // Already has background color, likely code
        }

        attributedString.addAttributes([
          .font: codeFont,
          .foregroundColor: filePathColor
        ], range: captureRange)
      }
    }
  }

  private static func applyPattern(
    _ pattern: String,
    to attributedString: NSMutableAttributedString,
    attributes: [NSAttributedString.Key: Any]
  ) {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return }

    let text = attributedString.string
    let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))

    // Process matches in reverse to preserve ranges
    for match in matches.reversed() {
      guard match.numberOfRanges >= 2 else { continue }

      let fullRange = match.range
      let contentRange = match.range(at: 1)

      guard let fullSwiftRange = Range(fullRange, in: text),
            let contentSwiftRange = Range(contentRange, in: text) else { continue }

      let content = String(text[contentSwiftRange])

      // Get existing attributes from the content range
      var newAttrs = attributedString.attributes(at: contentRange.location, effectiveRange: nil)
      for (key, value) in attributes {
        newAttrs[key] = value
      }

      let replacement = NSAttributedString(string: content, attributes: newAttrs)
      attributedString.replaceCharacters(in: fullRange, with: replacement)
    }
  }

  private static func applyLinkPattern(to attributedString: NSMutableAttributedString, textColor: UIColor) {
    let pattern = "\\[([^\\]]+)\\]\\(([^)]+)\\)"
    guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return }

    let text = attributedString.string
    let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))

    // Process matches in reverse to preserve ranges
    for match in matches.reversed() {
      guard match.numberOfRanges >= 3 else { continue }

      let fullRange = match.range
      let textRange = match.range(at: 1)
      let urlRange = match.range(at: 2)

      guard let textSwiftRange = Range(textRange, in: text),
            let urlSwiftRange = Range(urlRange, in: text) else { continue }

      let linkText = String(text[textSwiftRange])
      let urlString = String(text[urlSwiftRange])

      var attrs = attributedString.attributes(at: textRange.location, effectiveRange: nil)
      attrs[.foregroundColor] = textColor
      attrs[.underlineStyle] = NSUnderlineStyle.single.rawValue
      if let url = URL(string: urlString) {
        attrs[.link] = url
      }

      let replacement = NSAttributedString(string: linkText, attributes: attrs)
      attributedString.replaceCharacters(in: fullRange, with: replacement)
    }
  }

  /// Apply styling to media tags: [image: tagName], [video: tagName], [audio: tagName]
  /// Renders them as styled badges with icons
  private static func applyMediaTagStyling(to attributedString: NSMutableAttributedString, codeFont: UIFont) {
    let text = attributedString.string

    // Pattern matches [image: tagName], [video: tagName], [audio: tagName]
    // Tag names can contain letters, numbers, hyphens, underscores
    let mediaTagPattern = "\\[(image|video|audio):\\s*([\\w\\-]+)\\]"
    guard let regex = try? NSRegularExpression(pattern: mediaTagPattern, options: .caseInsensitive) else { return }

    let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))

    // Process in reverse to preserve ranges
    for match in matches.reversed() {
      guard match.numberOfRanges >= 3 else { continue }

      let fullRange = match.range
      let typeRange = match.range(at: 1)
      let tagNameRange = match.range(at: 2)

      guard let typeSwiftRange = Range(typeRange, in: text),
            let tagNameSwiftRange = Range(tagNameRange, in: text) else { continue }

      let mediaType = String(text[typeSwiftRange]).lowercased()
      let tagName = String(text[tagNameSwiftRange])

      // Determine icon based on media type
      let icon: String
      let color: UIColor
      switch mediaType {
      case "image":
        icon = "🖼️"
        color = UIColor(red: 0.4, green: 0.7, blue: 0.95, alpha: 1.0) // Blue tint
      case "video":
        icon = "🎬"
        color = UIColor(red: 0.95, green: 0.5, blue: 0.5, alpha: 1.0) // Red tint
      case "audio":
        icon = "🎵"
        color = UIColor(red: 0.5, green: 0.9, blue: 0.6, alpha: 1.0) // Green tint
      default:
        icon = "📎"
        color = mediaTagColor
      }

      // Create styled replacement text with icon
      let displayText = " \(icon) \(tagName) "

      // Get existing attributes
      var attrs = attributedString.attributes(at: fullRange.location, effectiveRange: nil)

      // Apply media tag styling
      attrs[.font] = codeFont
      attrs[.foregroundColor] = color
      attrs[.backgroundColor] = mediaTagBackgroundColor

      let replacement = NSAttributedString(string: displayText, attributes: attrs)
      attributedString.replaceCharacters(in: fullRange, with: replacement)
    }
  }
}
