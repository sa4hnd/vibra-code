/**
 * Copyright (c) 650 Industries.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Premium Vibe design system colors
export function getBackgroundColor(opacity?: number): string {
  return `rgba(26, 26, 26, ${opacity == null ? 1 : opacity})`; // #1A1A1A - Vibe modal background
}

export function getBackgroundLightColor(opacity?: number): string {
  return `rgba(42, 42, 42, ${opacity == null ? 1 : opacity})`; // #2A2A2A - Lighter Vibe background
}

export function getBackgroundDarkColor(opacity?: number): string {
  return `rgba(10, 10, 10, ${opacity == null ? 1 : opacity})`; // #0A0A0A - Darker Vibe background
}

export function getWarningColor(opacity?: number): string {
  return `rgba(255, 107, 53, ${opacity == null ? 1 : opacity})`; // #FF6B35 - Vibe orange
}

export function getWarningDarkColor(opacity?: number): string {
  return `rgba(229, 90, 43, ${opacity == null ? 1 : opacity})`; // #E55A2B - Darker Vibe orange
}

export function getFatalColor(opacity?: number): string {
  return `rgba(255, 107, 53, ${opacity == null ? 1 : opacity})`; // #FF6B35 - Use Vibe orange for fatal too
}

export function getFatalDarkColor(opacity?: number): string {
  return `rgba(229, 90, 43, ${opacity == null ? 1 : opacity})`; // #E55A2B - Darker Vibe orange
}

export function getErrorColor(opacity?: number): string {
  return `rgba(255, 107, 53, ${opacity == null ? 1 : opacity})`; // #FF6B35 - Vibe orange for errors
}

export function getErrorDarkColor(opacity?: number): string {
  return `rgba(229, 90, 43, ${opacity == null ? 1 : opacity})`; // #E55A2B - Darker Vibe orange
}

export function getLogColor(opacity?: number): string {
  return `rgba(136, 136, 136, ${opacity == null ? 1 : opacity})`; // #888888 - Vibe secondary text
}

export function getWarningHighlightColor(opacity?: number): string {
  return `rgba(255, 138, 91, ${opacity == null ? 1 : opacity})`; // #FF8A5B - Lighter Vibe orange
}

export function getDividerColor(opacity?: number): string {
  return `rgba(51, 51, 51, ${opacity == null ? 1 : opacity})`; // #333333 - Vibe border color
}

export function getHighlightColor(opacity?: number): string {
  return `rgba(255, 138, 91, ${opacity == null ? 1 : opacity})`; // #FF8A5B - Lighter Vibe orange
}

export function getTextColor(opacity?: number): string {
  return `rgba(255, 255, 255, ${opacity == null ? 1 : opacity})`; // White text
}
