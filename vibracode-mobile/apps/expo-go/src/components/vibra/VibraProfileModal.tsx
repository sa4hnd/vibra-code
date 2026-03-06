import { useUser } from '@clerk/clerk-expo';
import {
  User,
  ChevronRight,
  CreditCard,
  Bell,
  HelpCircle,
  Info,
  LogOut,
  X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';

import { useVibraAuth } from '../../contexts/VibraAuthContext';
import { VibraAboutUsScreen } from '../../screens/VibraAboutUsScreen';

interface VibraProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const VibraProfileModal: React.FC<VibraProfileModalProps> = ({ visible, onClose }) => {
  const { user } = useUser();
  const { signOut } = useVibraAuth();
  const [showAboutUs, setShowAboutUs] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            onClose();
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleAboutUs = () => {
    setShowAboutUs(true);
  };

  const handleBilling = () => {
    Alert.alert('Billing', 'Billing management will be available soon!');
  };

  const handleAccountSettings = () => {
    Alert.alert('Account Settings', 'Account settings will be available soon!');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* User Info Section */}
            <View style={styles.section}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user?.firstName?.charAt(0) ||
                      user?.emailAddresses[0]?.emailAddress?.charAt(0) ||
                      'U'}
                  </Text>
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.emailAddresses[0]?.emailAddress || 'User'}
                  </Text>
                  <Text style={styles.userEmail}>{user?.emailAddresses[0]?.emailAddress}</Text>
                </View>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              <TouchableOpacity style={styles.menuItem} onPress={handleAccountSettings}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <User size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Account Settings</Text>
                </View>
                <ChevronRight size={16} color="#666666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleBilling}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <CreditCard size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Billing & Subscription</Text>
                </View>
                <ChevronRight size={16} color="#666666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Bell size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Notifications</Text>
                </View>
                <ChevronRight size={16} color="#666666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <HelpCircle size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Help & Support</Text>
                </View>
                <ChevronRight size={16} color="#666666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleAboutUs}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Info size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>About</Text>
                </View>
                <ChevronRight size={16} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <View style={styles.signOutSection}>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={20} color="#FF6B35" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            {/* App Version */}
            <View style={styles.versionSection}>
              <Text style={styles.versionText}>Vibra v1.0.0</Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* About Us Modal */}
      <Modal visible={showAboutUs} animationType="slide" presentationStyle="fullScreen">
        <VibraAboutUsScreen navigation={{ goBack: () => setShowAboutUs(false) }} />
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 2,
    borderTopColor: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444444',
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444444',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    lineHeight: 24,
  },
  userEmail: {
    fontSize: 15,
    color: '#CCCCCC',
    fontWeight: '400',
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#444444',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  signOutSection: {
    marginBottom: 24,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  signOutText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionSection: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  versionText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
});
