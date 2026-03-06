import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Edit,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Terminal,
  Search as SearchIcon,
} from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import reactStringReplace from 'react-string-replace';

import { TextShimmer } from './TextShimmer';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface ChatMessage {
  _id: string;
  role?: string;
  content?: string;
  edits?: { filePath: string; oldString: string; newString: string } | any[];
  read?: { filePath: string };
  todos?: any[];
  bash?: any;
  webSearch?: any;
  image?: { fileName: string; path: string; storageId?: string };
  timestamp?: number;
}

// Pulsing dot component for in-progress todos
const PulsingDot: React.FC<{ style: any }> = ({ style }) => {
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, [pulseAnimation]);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulseAnimation }] }]}>
      <TextShimmer style={styles.todoDotShimmer} duration={1500}>
        {' '}
      </TextShimmer>
    </Animated.View>
  );
};

interface VibraChatMessageProps {
  message: ChatMessage;
  showAvatar?: boolean;
}

// Enhanced markdown renderer for React Native
const renderMarkdown = (text: string) => {
  if (!text) return null;

  // Trim the entire text to remove leading/trailing whitespace
  const trimmedText = text.trim();
  if (!trimmedText) return null;

  // Split text into lines for better processing
  const lines = trimmedText.split('\n');
  const renderedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers (###, ##, or #) - with bold text support
    if (line.startsWith('### ')) {
      const headerText = line.replace('### ', '');
      const boldMatches = headerText.match(/\*\*(.+?)\*\*/g);

      if (boldMatches) {
        const parts = [];
        let lastIndex = 0;

        boldMatches.forEach((match, idx) => {
          const matchIndex = headerText.indexOf(match, lastIndex);

          // Add text before bold
          if (matchIndex > lastIndex) {
            parts.push(headerText.substring(lastIndex, matchIndex));
          }

          // Add bold text
          const boldText = match.replace(/\*\*/g, '');
          parts.push(
            <Text key={`bold-${i}-${idx}`} style={styles.markdownBold}>
              {boldText}
            </Text>
          );

          lastIndex = matchIndex + match.length;
        });

        // Add remaining text
        if (lastIndex < headerText.length) {
          parts.push(headerText.substring(lastIndex));
        }

        renderedLines.push(
          <Text key={i} style={styles.markdownHeaderH3}>
            {parts}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={i} style={styles.markdownHeaderH3}>
            {headerText}
          </Text>
        );
      }
    } else if (line.startsWith('## ')) {
      const headerText = line.replace('## ', '');
      const boldMatches = headerText.match(/\*\*(.+?)\*\*/g);

      if (boldMatches) {
        const parts = [];
        let lastIndex = 0;

        boldMatches.forEach((match, idx) => {
          const matchIndex = headerText.indexOf(match, lastIndex);

          // Add text before bold
          if (matchIndex > lastIndex) {
            parts.push(headerText.substring(lastIndex, matchIndex));
          }

          // Add bold text
          const boldText = match.replace(/\*\*/g, '');
          parts.push(
            <Text key={`bold-${i}-${idx}`} style={styles.markdownBold}>
              {boldText}
            </Text>
          );

          lastIndex = matchIndex + match.length;
        });

        // Add remaining text
        if (lastIndex < headerText.length) {
          parts.push(headerText.substring(lastIndex));
        }

        renderedLines.push(
          <Text key={i} style={styles.markdownHeaderH2}>
            {parts}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={i} style={styles.markdownHeaderH2}>
            {headerText}
          </Text>
        );
      }
    } else if (line.startsWith('# ')) {
      const headerText = line.replace('# ', '');
      const boldMatches = headerText.match(/\*\*(.+?)\*\*/g);

      if (boldMatches) {
        const parts = [];
        let lastIndex = 0;

        boldMatches.forEach((match, idx) => {
          const matchIndex = headerText.indexOf(match, lastIndex);

          // Add text before bold
          if (matchIndex > lastIndex) {
            parts.push(headerText.substring(lastIndex, matchIndex));
          }

          // Add bold text
          const boldText = match.replace(/\*\*/g, '');
          parts.push(
            <Text key={`bold-${i}-${idx}`} style={styles.markdownBold}>
              {boldText}
            </Text>
          );

          lastIndex = matchIndex + match.length;
        });

        // Add remaining text
        if (lastIndex < headerText.length) {
          parts.push(headerText.substring(lastIndex));
        }

        renderedLines.push(
          <Text key={i} style={styles.markdownHeaderH1}>
            {parts}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={i} style={styles.markdownHeaderH1}>
            {headerText}
          </Text>
        );
      }
    }
    // Numbered lists (1. text, 2. text, etc.)
    else if (line.match(/^\d+\.\s/)) {
      const processedLine = line.replace(/^\d+\.\s/, '');

      // Handle bold text within numbered lists
      const boldMatches = processedLine.match(/\*\*(.+?)\*\*/g);
      if (boldMatches) {
        const parts = [];
        let lastIndex = 0;

        boldMatches.forEach((match, idx) => {
          const matchIndex = processedLine.indexOf(match, lastIndex);

          // Add text before bold
          if (matchIndex > lastIndex) {
            parts.push(processedLine.substring(lastIndex, matchIndex));
          }

          // Add bold text
          const boldText = match.replace(/\*\*/g, '');
          parts.push(
            <Text key={`bold-${i}-${idx}`} style={styles.markdownBold}>
              {boldText}
            </Text>
          );

          lastIndex = matchIndex + match.length;
        });

        // Add remaining text
        if (lastIndex < processedLine.length) {
          parts.push(processedLine.substring(lastIndex));
        }

        renderedLines.push(
          <Text key={i} style={styles.markdownNumbered}>
            {line.match(/^\d+\./)?.[0] || ''} {parts}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={i} style={styles.markdownNumbered}>
            {line.match(/^\d+\./)?.[0] || ''} {processedLine}
          </Text>
        );
      }
    }
    // Bullet points (- text)
    else if (line.startsWith('- ')) {
      const processedLine = line.replace('- ', '');

      // Handle bold text within bullet points
      const boldMatches = processedLine.match(/\*\*(.+?)\*\*/g);
      if (boldMatches) {
        const parts = [];
        let lastIndex = 0;

        boldMatches.forEach((match, idx) => {
          const matchIndex = processedLine.indexOf(match, lastIndex);

          // Add text before bold
          if (matchIndex > lastIndex) {
            parts.push(processedLine.substring(lastIndex, matchIndex));
          }

          // Add bold text
          const boldText = match.replace(/\*\*/g, '');
          parts.push(
            <Text key={`bold-${i}-${idx}`} style={styles.markdownBold}>
              {boldText}
            </Text>
          );

          lastIndex = matchIndex + match.length;
        });

        // Add remaining text
        if (lastIndex < processedLine.length) {
          parts.push(processedLine.substring(lastIndex));
        }

        renderedLines.push(
          <Text key={i} style={styles.markdownBullet}>
            • {parts}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={i} style={styles.markdownBullet}>
            • {processedLine}
          </Text>
        );
      }
    }
    // Regular text with potential bold formatting
    else if (line.trim()) {
      const boldMatches = line.match(/\*\*(.+?)\*\*/g);
      if (boldMatches) {
        const parts = [];
        let lastIndex = 0;

        boldMatches.forEach((match, idx) => {
          const matchIndex = line.indexOf(match, lastIndex);

          // Add text before bold
          if (matchIndex > lastIndex) {
            parts.push(line.substring(lastIndex, matchIndex));
          }

          // Add bold text
          const boldText = match.replace(/\*\*/g, '');
          parts.push(
            <Text key={`bold-${i}-${idx}`} style={styles.markdownBold}>
              {boldText}
            </Text>
          );

          lastIndex = matchIndex + match.length;
        });

        // Add remaining text
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }

        renderedLines.push(
          <Text key={i} style={styles.assistantTextPlain}>
            {parts}
          </Text>
        );
      } else {
        renderedLines.push(
          <Text key={i} style={styles.assistantTextPlain}>
            {line}
          </Text>
        );
      }
    }
    // Empty lines for spacing - only add if not the last line
    else if (i < lines.length - 1) {
      renderedLines.push(
        <Text key={i} style={styles.assistantTextPlain}>
          {'\n'}
        </Text>
      );
    }
  }

  return renderedLines;
};

export const VibraChatMessage: React.FC<VibraChatMessageProps> = ({ message, showAvatar = true }) => {
  const handleCopyMessage = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert('Copied', 'Message copied to clipboard', [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy message');
    }
  };
  // File operations - fix text alignment to left
  if (message.edits) {
    const editsArray = Array.isArray(message.edits) ? message.edits : [message.edits];

    if (editsArray.length > 0) {
      return (
        <View style={styles.compactOperation}>
          <View style={styles.compactIcon}>
            <Edit size={12} color={VibraColors.neutral.textSecondary} />
          </View>
          <Text style={styles.compactLabel}>Updated:</Text>
          <Text style={styles.compactValue} numberOfLines={1}>
            {editsArray.map((edit) => edit.filePath || edit.fileName).join(', ')}
          </Text>
        </View>
      );
    }
  }

  // File read operations - fix text alignment to left
  if (message.read) {
    return (
      <View style={styles.compactOperation}>
        <View style={styles.compactIcon}>
          <FileText size={12} color={VibraColors.neutral.textSecondary} />
        </View>
        <Text style={styles.compactLabel}>Read:</Text>
        <Text style={styles.compactValue} numberOfLines={1}>
          {message.read.filePath}
        </Text>
      </View>
    );
  }

  // Image operations - fix text alignment to left
  if (message.image) {
    return (
      <View style={styles.compactOperation}>
        <View style={styles.compactIcon}>
          <ImageIcon size={12} color={VibraColors.neutral.textSecondary} />
        </View>
        <Text style={styles.compactLabel}>Image:</Text>
        <Text style={styles.compactValue} numberOfLines={1}>
          {message.image.fileName}
        </Text>
      </View>
    );
  }

  // Todo list - v0-clone style adapted for expo
  if (message.todos && message.todos.length > 0) {
    const completedCount = message.todos.filter(
      (todo) =>
        todo.status?.toLowerCase() === 'completed' ||
        todo.status?.toLowerCase() === 'done' ||
        todo.completed === true
    ).length;
    const totalCount = message.todos.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
      <View style={styles.todoContainer}>
        <View style={styles.todoContent}>
          <View style={styles.todoHeader}>
            <CheckCircle size={16} color={VibraColors.neutral.textSecondary} />
            <Text style={styles.todoHeaderText}>Tasks</Text>
            <View style={styles.todoProgress}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {completedCount}/{totalCount}
              </Text>
            </View>
          </View>

          <View style={styles.todoItems}>
            {message.todos.map((todo: any, index: number) => {
              const isCompleted =
                todo.status?.toLowerCase() === 'completed' ||
                todo.status?.toLowerCase() === 'done' ||
                todo.completed === true;
              const isInProgress = todo.status?.toLowerCase() === 'in_progress';

              return (
                <View
                  key={todo.id || index}
                  style={[styles.todoItem, isCompleted && styles.todoItemCompleted]}>
                  {isInProgress ? (
                    <PulsingDot style={[styles.todoDot, styles.todoDotInProgress]} />
                  ) : (
                    <View style={[styles.todoDot, isCompleted && styles.todoDotCompleted]} />
                  )}
                  <Text style={[styles.todoItemText, isCompleted && styles.todoItemTextCompleted]}>
                    {todo.content || todo.text || todo.description}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // Bash commands - compact design like v0-clone
  if (message.bash) {
    return (
      <View style={styles.compactOperation}>
        <View style={styles.compactIcon}>
          <Terminal size={12} color={VibraColors.neutral.textSecondary} />
        </View>
        <Text style={styles.compactLabel}>Terminal:</Text>
        <Text style={styles.compactValue} numberOfLines={1}>
          {message.bash.command}
        </Text>
        {message.bash.exitCode !== undefined && message.bash.exitCode !== 0 && (
          <Text style={styles.exitCode}>{message.bash.exitCode}</Text>
        )}
      </View>
    );
  }

  // Web search - compact design like v0-clone
  if (message.webSearch) {
    return (
      <View style={styles.compactOperation}>
        <View style={styles.compactIcon}>
          <SearchIcon size={12} color={VibraColors.neutral.textSecondary} />
        </View>
        <Text style={styles.compactLabel}>Search:</Text>
        <Text style={styles.compactValue} numberOfLines={1}>
          {message.webSearch.query}
        </Text>
      </View>
    );
  }

  // User message - with bubble styling, aligned to right
  if (message.role === 'user') {
    return (
      <View style={styles.userMessageContainer}>
        <TouchableOpacity
          style={styles.userMessage}
          onLongPress={() => message.content && handleCopyMessage(message.content)}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#007AFF', '#0051D5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userMessageGradient}>
            <Text style={styles.userText}>{message.content}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // Assistant message - plain text without bubble container
  if (message.role === 'assistant' && message.content) {
    const renderedContent = renderMarkdown(message.content);

    return (
      <View style={styles.messageContainer}>
        <TouchableOpacity
          style={styles.assistantMessagePlain}
          onLongPress={() => message.content && handleCopyMessage(message.content)}
          activeOpacity={0.8}>
          {renderedContent}
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 6,
  },

  // Compact operations - professional styling
  compactOperation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 8,
    marginHorizontal: 0,
    borderLeftWidth: 3,
    borderLeftColor: VibraColors.neutral.textSecondary,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  compactIcon: {
    marginRight: 10,
  },
  compactLabel: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  compactValue: {
    color: VibraColors.neutral.text,
    fontSize: 12,
    flex: 1,
    textAlign: 'left',
    fontWeight: '400',
  },
  exitCode: {
    color: '#FFFFFF',
    fontSize: 11,
    backgroundColor: VibraColors.neutral.textTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
    fontWeight: '500',
  },

  // Todo container - professional styling
  todoContainer: {
    marginBottom: VibraSpacing.lg,
    marginHorizontal: 0,
  },
  todoContent: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 12,
    padding: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.md,
    paddingBottom: VibraSpacing.md,
    paddingTop: VibraSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  todoHeaderText: {
    color: VibraColors.neutral.text,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: VibraSpacing.md,
    flex: 1,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  todoProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    width: 70,
    height: 6,
    backgroundColor: VibraColors.neutral.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: VibraSpacing.md,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  progressFill: {
    height: '100%',
    backgroundColor: VibraColors.neutral.textSecondary,
    borderRadius: 3,
    shadowColor: VibraColors.neutral.textSecondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  progressText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  todoItems: {
    gap: VibraSpacing.md,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.sm,
    paddingHorizontal: VibraSpacing.xs,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  todoItemCompleted: {
    opacity: 0.7,
  },
  todoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: VibraSpacing.md,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: 'rgba(255, 255, 255, 0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  todoDotCompleted: {
    backgroundColor: VibraColors.neutral.textSecondary,
    borderColor: VibraColors.neutral.textSecondary,
  },
  todoDotInProgress: {
    backgroundColor: VibraColors.accent.amber,
    borderColor: VibraColors.accent.amber,
    borderWidth: 0,
    shadowColor: VibraColors.accent.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  todoDotShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: VibraColors.accent.amber,
    borderRadius: 6,
  },
  todoItemText: {
    color: VibraColors.neutral.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(255, 255, 255, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  todoItemTextCompleted: {
    textDecorationLine: 'line-through',
    color: VibraColors.neutral.textSecondary,
    opacity: 0.7,
  },

  // Assistant messages - plain text without bubble
  assistantMessagePlain: {
    marginVertical: VibraSpacing.sm,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  assistantTextPlain: {
    color: VibraColors.neutral.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // Markdown styles - professional styling
  markdownHeaderH1: {
    color: VibraColors.neutral.text,
    fontSize: 20,
    fontWeight: '700',
    marginVertical: VibraSpacing.md,
    marginBottom: VibraSpacing.lg,
    letterSpacing: -0.3,
  },
  markdownHeaderH2: {
    color: VibraColors.neutral.text,
    fontSize: 18,
    fontWeight: '600',
    marginVertical: VibraSpacing.sm,
    marginBottom: VibraSpacing.md,
    letterSpacing: -0.2,
  },
  markdownHeaderH3: {
    color: VibraColors.neutral.text,
    fontSize: 16,
    fontWeight: '600',
    marginVertical: VibraSpacing.sm,
    marginBottom: VibraSpacing.sm,
    letterSpacing: -0.1,
  },
  markdownBold: {
    fontWeight: '600',
    color: VibraColors.neutral.text,
  },
  markdownBullet: {
    color: VibraColors.neutral.text,
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 2,
    paddingLeft: VibraSpacing.md,
  },
  markdownNumbered: {
    color: VibraColors.neutral.text,
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 2,
    paddingLeft: VibraSpacing.md,
  },

  // User messages - right-aligned bubble styling
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: VibraSpacing.sm,
    marginHorizontal: 0,
    paddingLeft: 40, // Add left padding to push bubble to right
  },
  userMessage: {
    borderRadius: 18,
    maxWidth: '75%',
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  userMessageGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
});
