import { X, Clock, Type, Flag, Check } from 'lucide-react-native';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

interface VibraSortModalProps {
  visible: boolean;
  onClose: () => void;
  currentSort: 'newest' | 'oldest' | 'name' | 'status';
  onSortSelect: (sort: 'newest' | 'oldest' | 'name' | 'status') => void;
}

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First', icon: 'clock' },
  { key: 'oldest', label: 'Oldest First', icon: 'clock' },
  { key: 'name', label: 'Name A-Z', icon: 'type' },
  { key: 'status', label: 'By Status', icon: 'flag' },
] as const;

export const VibraSortModal: React.FC<VibraSortModalProps> = ({
  visible,
  onClose,
  currentSort,
  onSortSelect,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Sort Projects</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.option, currentSort === option.key && styles.optionSelected]}
                onPress={() => onSortSelect(option.key)}>
                {option.icon === 'clock' && (
                  <Clock size={20} color={currentSort === option.key ? '#FF6B35' : '#CCCCCC'} />
                )}
                {option.icon === 'type' && (
                  <Type size={20} color={currentSort === option.key ? '#FF6B35' : '#CCCCCC'} />
                )}
                {option.icon === 'flag' && (
                  <Flag size={20} color={currentSort === option.key ? '#FF6B35' : '#CCCCCC'} />
                )}
                <Text
                  style={[
                    styles.optionText,
                    currentSort === option.key && styles.optionTextSelected,
                  ]}>
                  {option.label}
                </Text>
                {currentSort === option.key && <Check size={20} color="#FF6B35" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444444',
    width: '100%',
    maxWidth: 320,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444444',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  options: {
    padding: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  optionSelected: {
    backgroundColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  optionText: {
    flex: 1,
    color: '#CCCCCC',
    fontSize: 16,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
});

export default VibraSortModal;
