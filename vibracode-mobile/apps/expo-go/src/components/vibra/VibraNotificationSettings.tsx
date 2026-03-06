import * as Notifications from 'expo-notifications';
import {
  X,
  Bell,
  BellOff,
  Wrench,
  CreditCard,
  Zap,
  Settings,
  Send,
  ChevronRight,
  Info,
  ShieldCheck,
} from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
} from 'react-native';

import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';
import { vibeNotificationService } from '../../services/VibraNotificationService';

interface VibraNotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export const VibraNotificationSettings: React.FC<VibraNotificationSettingsProps> = ({
  visible,
  onClose,
}) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [buildNotifications, setBuildNotifications] = useState(true);
  const [billingNotifications, setBillingNotifications] = useState(true);
  const [tokenNotifications, setTokenNotifications] = useState(true);
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkNotificationPermissions();

    // Add notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      // Don't show alert for test notifications to avoid double alerts
      // The notification will still appear in the notification panel
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      Alert.alert('Notification Tapped', 'You tapped on a notification!');
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const checkNotificationPermissions = async () => {
    try {
      const isEnabled = await vibeNotificationService.areNotificationsEnabled();
      setNotificationsEnabled(isEnabled);
    } catch (error) {
      console.error('Error checking notification permissions:', error);
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      setIsLoading(true);
      const isGranted = await vibeNotificationService.requestPermissions();

      if (isGranted) {
        setNotificationsEnabled(true);
        Alert.alert('Success', 'Notification permissions granted!');
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in Settings to receive updates.'
        );
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      if (!notificationsEnabled) {
        Alert.alert('Notifications Disabled', 'Please enable notifications first.');
        return;
      }

      await vibeNotificationService.sendTestNotification();
      Alert.alert(
        'Test Sent',
        'Test notification sent successfully! Check your notification panel.'
      );
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert(
        'Error',
        `Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleNotificationToggle = async () => {
    if (notificationsEnabled) {
      // Disable notifications
      setNotificationsEnabled(false);
      Alert.alert('Notifications Disabled', 'You will no longer receive notifications.');
    } else {
      // Request permissions
      await requestNotificationPermissions();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Settings</Text>
          <View style={styles.closeButtonPlaceholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>

            <View style={styles.mainToggleCard}>
              <View style={styles.mainToggleContent}>
                <View style={styles.mainToggleIcon}>
                  {notificationsEnabled ? (
                    <Bell size={24} color={VibraColors.accent.amber} />
                  ) : (
                    <BellOff size={24} color={VibraColors.neutral.textTertiary} />
                  )}
                </View>
                <View style={styles.mainToggleText}>
                  <Text style={styles.mainToggleTitle}>
                    {notificationsEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
                  </Text>
                  <Text style={styles.mainToggleSubtitle}>
                    {notificationsEnabled
                      ? 'You will receive notifications for important updates'
                      : 'Allow Vibra to send you notifications'}
                  </Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{
                    false: VibraColors.neutral.backgroundTertiary,
                    true: VibraColors.accent.amber,
                  }}
                  thumbColor={notificationsEnabled ? '#FFFFFF' : VibraColors.neutral.textTertiary}
                  disabled={isLoading}
                />
              </View>
            </View>
          </View>

          {/* Notification Types */}
          {notificationsEnabled && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notification Types</Text>

              <View style={styles.notificationTypesCard}>
                <TouchableOpacity
                  style={styles.notificationTypeItem}
                  onPress={() => setBuildNotifications(!buildNotifications)}>
                  <View style={styles.notificationTypeLeft}>
                    <View style={styles.notificationTypeIcon}>
                      <Wrench size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.notificationTypeText}>
                      <Text style={styles.notificationTypeTitle}>Build Updates</Text>
                      <Text style={styles.notificationTypeSubtitle}>
                        When your app generation completes
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={buildNotifications}
                    onValueChange={setBuildNotifications}
                    trackColor={{
                      false: VibraColors.neutral.backgroundTertiary,
                      true: VibraColors.accent.amber,
                    }}
                    thumbColor={buildNotifications ? '#FFFFFF' : VibraColors.neutral.textTertiary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.notificationTypeItem}
                  onPress={() => setBillingNotifications(!billingNotifications)}>
                  <View style={styles.notificationTypeLeft}>
                    <View style={styles.notificationTypeIcon}>
                      <CreditCard size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.notificationTypeText}>
                      <Text style={styles.notificationTypeTitle}>Billing & Payments</Text>
                      <Text style={styles.notificationTypeSubtitle}>
                        Payment confirmations and billing alerts
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={billingNotifications}
                    onValueChange={setBillingNotifications}
                    trackColor={{
                      false: VibraColors.neutral.backgroundTertiary,
                      true: VibraColors.accent.amber,
                    }}
                    thumbColor={billingNotifications ? '#FFFFFF' : VibraColors.neutral.textTertiary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.notificationTypeItem}
                  onPress={() => setTokenNotifications(!tokenNotifications)}>
                  <View style={styles.notificationTypeLeft}>
                    <View style={styles.notificationTypeIcon}>
                      <Zap size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.notificationTypeText}>
                      <Text style={styles.notificationTypeTitle}>Token Usage</Text>
                      <Text style={styles.notificationTypeSubtitle}>
                        When you're running low on tokens
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={tokenNotifications}
                    onValueChange={setTokenNotifications}
                    trackColor={{
                      false: VibraColors.neutral.backgroundTertiary,
                      true: VibraColors.accent.amber,
                    }}
                    thumbColor={tokenNotifications ? '#FFFFFF' : VibraColors.neutral.textTertiary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.notificationTypeItem}
                  onPress={() => setSystemNotifications(!systemNotifications)}>
                  <View style={styles.notificationTypeLeft}>
                    <View style={styles.notificationTypeIcon}>
                      <Settings size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.notificationTypeText}>
                      <Text style={styles.notificationTypeTitle}>System Updates</Text>
                      <Text style={styles.notificationTypeSubtitle}>
                        App updates and maintenance
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={systemNotifications}
                    onValueChange={setSystemNotifications}
                    trackColor={{
                      false: VibraColors.neutral.backgroundTertiary,
                      true: VibraColors.accent.amber,
                    }}
                    thumbColor={systemNotifications ? '#FFFFFF' : VibraColors.neutral.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Test Notification */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Notifications</Text>

            <TouchableOpacity
              style={styles.testButton}
              onPress={sendTestNotification}
              disabled={!notificationsEnabled || isLoading}>
              <View style={styles.testButtonContent}>
                <View style={styles.testButtonIcon}>
                  <Send size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.testButtonText}>Send Test Notification</Text>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Notifications</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoItem}>
                <Info size={20} color={VibraColors.accent.blue} />
                <Text style={styles.infoText}>
                  Notifications help you stay updated on your app generation progress and important
                  account changes.
                </Text>
              </View>

              <View style={styles.infoItem}>
                <ShieldCheck size={20} color={VibraColors.accent.amber} />
                <Text style={styles.infoText}>
                  You can change these settings anytime. We respect your privacy and won't send
                  unnecessary notifications.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: VibraColors.neutral.background,
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
  mainToggleCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    padding: VibraSpacing.xl,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  mainToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainToggleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  mainToggleText: {
    flex: 1,
  },
  mainToggleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  mainToggleSubtitle: {
    fontSize: 14,
    color: VibraColors.neutral.textSecondary,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  notificationTypesCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  notificationTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
  },
  notificationTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  notificationTypeText: {
    flex: 1,
  },
  notificationTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  notificationTypeSubtitle: {
    fontSize: 14,
    color: VibraColors.neutral.textSecondary,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  testButton: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.lg,
  },
  testButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.accent.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    shadowColor: VibraColors.accent.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  testButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    letterSpacing: -0.2,
  },
  infoCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    padding: VibraSpacing.xl,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: VibraSpacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: VibraColors.neutral.textSecondary,
    fontWeight: '500',
    marginLeft: VibraSpacing.md,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
});
