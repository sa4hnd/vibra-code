import { useUser } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, ChevronRight, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';

import { VibraCosmicBackground } from './VibraCosmicBackground';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface VibraAccountSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export const VibraAccountSettings: React.FC<VibraAccountSettingsProps> = ({ visible, onClose }) => {
  const { user } = useUser();

  // Form state - read-only display
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const username = user?.username || '';
  const emailAddress = user?.emailAddresses[0]?.emailAddress || '';

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'Password changes are handled through email verification. Check your email for instructions.',
      [{ text: 'OK' }]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Account Deletion',
              'To delete your account, please contact support at support@vibracodeapp.com',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <VibraCosmicBackground>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Account Settings</Text>
            <View style={styles.closeButtonPlaceholder} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Information</Text>

              {/* Avatar */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  {user.imageUrl ? (
                    <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
                  ) : (
                    <LinearGradient
                      colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.avatarGradient}>
                      <Text style={styles.avatarText}>
                        {user.firstName?.charAt(0) ||
                          user.emailAddresses[0]?.emailAddress?.charAt(0) ||
                          'U'}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
              </View>

              {/* Form Fields */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={firstName || 'Not set'}
                    editable={false}
                    placeholderTextColor={VibraColors.neutral.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={lastName || 'Not set'}
                    editable={false}
                    placeholderTextColor={VibraColors.neutral.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={username || 'Not set'}
                    editable={false}
                    placeholderTextColor={VibraColors.neutral.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={emailAddress}
                    editable={false}
                    placeholderTextColor={VibraColors.neutral.textSecondary}
                  />
                </View>
              </View>
            </View>

            {/* Security Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security</Text>
              <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Lock size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Change Password</Text>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>
            </View>

            {/* Danger Zone */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              <TouchableOpacity
                style={[styles.menuItem, styles.dangerItem]}
                onPress={handleDeleteAccount}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Trash2 size={20} color="#FF6B6B" />
                  </View>
                  <Text style={[styles.menuText, styles.dangerText]}>Delete Account</Text>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </VibraCosmicBackground>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.lg,
    paddingBottom: VibraSpacing.md,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButton: {
    padding: VibraSpacing.sm,
  },
  closeButtonPlaceholder: {
    width: 24 + VibraSpacing.sm * 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: VibraSpacing.lg,
  },
  section: {
    marginTop: VibraSpacing['2xl'],
    marginBottom: VibraSpacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    marginBottom: VibraSpacing.xl,
    letterSpacing: -0.3,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: VibraSpacing['2xl'],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: VibraSpacing.md,
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: -0.3,
  },
  formSection: {
    gap: VibraSpacing.lg,
  },
  inputGroup: {
    marginBottom: VibraSpacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    marginBottom: VibraSpacing.sm,
    letterSpacing: -0.1,
  },
  input: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    fontSize: 16,
    color: VibraColors.neutral.text,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  inputDisabled: {
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    color: VibraColors.neutral.textSecondary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    paddingVertical: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: VibraSpacing.md,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: VibraBorderRadius.md,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  dangerItem: {
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B40',
  },
  dangerText: {
    color: '#FF6B6B',
  },
});
