import {
  ChevronLeft,
  HelpCircle,
  Zap,
  Rocket,
  AlertTriangle,
  Mail,
  Clock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';

import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraColors, VibraSpacing } from '../constants/VibraColors';

interface VibraHelpScreenProps {
  navigation: any;
}

export const VibraHelpScreen: React.FC<VibraHelpScreenProps> = ({ navigation }) => {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const handleEmailSupport = () => {
    Linking.openURL('mailto:hello@vibracodeapp.com?subject=Help & Support');
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const faqData = [
    {
      question: 'How does Vibra Code work?',
      answer:
        'Simply describe your app idea in plain English, and our AI will generate a complete, production-ready application for you. No coding knowledge required!',
    },
    {
      question: 'What types of apps can I create?',
      answer:
        'You can create web apps, mobile apps, APIs, and full-stack applications. From simple landing pages to complex SaaS platforms, our AI can handle it all.',
    },
    {
      question: 'How much does it cost?',
      answer:
        'We offer a free tier with limited generations, and premium plans starting at $29/month for unlimited app generations and advanced features.',
    },
    {
      question: 'How long does it take to generate an app?',
      answer:
        "Most apps are generated within 2-5 minutes. Complex applications may take up to 10 minutes. You'll receive a notification when your app is ready.",
    },
    {
      question: 'Can I customize the generated code?',
      answer:
        "Absolutely! You get full access to the source code and can modify it however you want. We provide clean, well-documented code that's easy to understand and customize.",
    },
    {
      question: 'What programming languages do you support?',
      answer:
        'We support React, Next.js, Node.js, Python, TypeScript, and more. The AI chooses the best tech stack for your specific app requirements.',
    },
    {
      question: 'Is my data secure?',
      answer:
        'Yes! We use enterprise-grade security measures. Your app ideas and generated code are encrypted and never shared with third parties. You own all the code we generate.',
    },
    {
      question: "Can I get help if I'm stuck?",
      answer:
        'Of course! Our support team is available 24/7. You can email us at hello@vibracodeapp.com or use the in-app chat for immediate assistance.',
    },
    {
      question: 'Can I use the generated apps commercially?',
      answer:
        'Yes! You have full commercial rights to all apps generated through Vibra Code. You can sell, distribute, or use them for any business purpose.',
    },
  ];

  return (
    <VibraCosmicBackground>
      {/* Header Container - matches other screens exactly */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={VibraColors.neutral.textTertiary} />
          </TouchableOpacity>
          <Text style={styles.title}>Help & Support</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroContent}>
              <View style={styles.iconContainer}>
                <HelpCircle size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.heroTitle}>How can we help you?</Text>
              <Text style={styles.heroDescription}>
                Get answers to common questions and find the support you need
              </Text>
            </View>
          </View>

          {/* Quick Help Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Zap size={20} color={VibraColors.neutral.textSecondary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Quick Help</Text>
            </View>
            <Text style={styles.sectionText}>
              Need immediate assistance? Check out our frequently asked questions or get in touch
              with our support team.
            </Text>
          </View>

          {/* Getting Started Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Rocket
                size={20}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Getting Started</Text>
            </View>
            <Text style={styles.sectionText}>
              New to Vibra Code? Learn how to create your first app, understand our pricing, and
              make the most of our platform.
            </Text>
          </View>

          {/* Common Issues Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertTriangle
                size={20}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Common Issues</Text>
            </View>
            <Text style={styles.sectionText}>
              Having trouble with your app generation, billing, or account? We've got solutions for
              the most common problems.
            </Text>
          </View>

          {/* Contact Support Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Mail size={20} color={VibraColors.neutral.textSecondary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Contact Support</Text>
            </View>
            <Text style={styles.sectionText}>
              Can't find what you're looking for? Our support team is here to help you succeed.
            </Text>
            <TouchableOpacity style={styles.contactButton} onPress={handleEmailSupport}>
              <Mail size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.contactButtonText}>Email Support</Text>
            </TouchableOpacity>
          </View>

          {/* FAQ Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <HelpCircle
                size={20}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            </View>
            <Text style={styles.sectionText}>
              Find quick answers to the most common questions about Vibra Code and our services.
            </Text>
          </View>

          {/* FAQ Items */}
          {faqData.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleFAQ(index)}
                activeOpacity={0.7}>
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                {expandedFAQ === index ? (
                  <ChevronUp size={20} color="#FFFFFF" />
                ) : (
                  <ChevronDown size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              {expandedFAQ === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Response Time Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock
                size={20}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Response Time</Text>
            </View>
            <Text style={styles.sectionText}>
              We typically respond to support requests within 24 hours. For urgent issues, please
              mention "URGENT" in your email subject.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.versionSection}>
            <View style={styles.versionCard}>
              <Text style={styles.versionText}>Need more help? We're here for you</Text>
              <Text style={styles.versionNumber}>Support • Europe</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  // Content wrapper - matches other screens exactly
  contentWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },

  // Header Container - matches other screens exactly
  headerContainer: {
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
    minHeight: 64,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Full-width scroll area - matches chat screen
  scrollArea: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing['6xl'],
    flexGrow: 1,
  },

  // Hero section
  heroSection: {
    marginBottom: 16,
    position: 'relative',
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'visible',
    padding: 32,
  },

  // Hero content
  heroContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: VibraSpacing['2xl'],
  },
  heroTitle: {
    color: VibraColors.neutral.text,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroDescription: {
    color: '#CCCCCC',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.2,
    opacity: 0.9,
  },

  // Section headers with icons
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.md,
  },
  sectionIcon: {
    marginRight: VibraSpacing.md,
    marginTop: 1,
  },

  // Section titles and text
  sectionTitle: {
    color: VibraColors.neutral.text,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    flex: 1,
  },
  sectionText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.2,
    opacity: 0.9,
  },

  // Regular section styling - matches project cards
  section: {
    marginBottom: 16,
    position: 'relative',
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'visible',
    padding: 24,
  },

  // Contact button
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    borderRadius: 12,
    marginTop: VibraSpacing.lg,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonIcon: {
    marginRight: VibraSpacing.sm,
    color: '#000000',
  },
  contactButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },

  // FAQ items
  faqItem: {
    marginBottom: 12,
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
  },
  faqQuestionText: {
    color: VibraColors.neutral.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: VibraSpacing.sm,
    lineHeight: 22,
  },
  faqAnswer: {
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    backgroundColor: VibraColors.surface.card,
  },
  faqAnswerText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    opacity: 0.9,
  },

  // Version section
  versionSection: {
    alignItems: 'center',
    paddingTop: VibraSpacing['3xl'],
    paddingBottom: VibraSpacing.lg,
  },
  versionCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    paddingHorizontal: VibraSpacing.xl,
    paddingVertical: VibraSpacing.lg,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: VibraColors.neutral.text,
    fontWeight: '500',
    marginBottom: VibraSpacing.sm,
    textAlign: 'center',
    opacity: 0.9,
  },
  versionNumber: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default VibraHelpScreen;
