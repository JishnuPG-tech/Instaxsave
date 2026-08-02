import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/store/settings';
import * as Application from 'expo-application';

export default function Settings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { 
    defaultQuality, 
    setDefaultQuality, 
    concurrentDownloads, 
    setConcurrentDownloads,
    theme,
    setTheme
  } = useSettings();

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title.toUpperCase()}</Text>
  );

  const renderOption = (
    label: string, 
    value: string, 
    isSelected: boolean, 
    onSelect: () => void,
    icon?: keyof typeof Feather.glyphMap
  ) => (
    <TouchableOpacity 
      style={[styles.optionRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} 
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.optionLabelRow}>
        {icon && <Feather name={icon} size={18} color={colors.foreground} style={styles.optionIcon} />}
        <Text style={[styles.optionText, { color: colors.foreground }]}>{label}</Text>
      </View>
      {isSelected ? (
        <Feather name="check" size={20} color={colors.primary} />
      ) : (
        <Text style={[styles.optionValueText, { color: colors.mutedForeground }]}>{value}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 84 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {renderSectionHeader('Default Quality')}
          <View style={[styles.cardGroup, { borderColor: colors.border }]}>
            {renderOption('Best Available', '', defaultQuality === 'best', () => setDefaultQuality('best'), 'star')}
            {renderOption('1080p', '', defaultQuality === '1080p', () => setDefaultQuality('1080p'), 'video')}
            {renderOption('720p', '', defaultQuality === '720p', () => setDefaultQuality('720p'), 'video')}
            {renderOption('Audio Only', '', defaultQuality === 'audio', () => setDefaultQuality('audio'), 'music')}
          </View>
        </View>

        <View style={styles.section}>
          {renderSectionHeader('Concurrent Downloads')}
          <View style={[styles.cardGroup, { borderColor: colors.border }]}>
            {renderOption('1 File', '', concurrentDownloads === 1, () => setConcurrentDownloads(1))}
            {renderOption('2 Files', '', concurrentDownloads === 2, () => setConcurrentDownloads(2))}
            {renderOption('3 Files', '', concurrentDownloads === 3, () => setConcurrentDownloads(3))}
          </View>
        </View>

        <View style={styles.section}>
          {renderSectionHeader('Appearance')}
          <View style={[styles.cardGroup, { borderColor: colors.border }]}>
            {renderOption('System Default', '', theme === 'system', () => setTheme('system'), 'smartphone')}
            {renderOption('Light Mode', '', theme === 'light', () => setTheme('light'), 'sun')}
            {renderOption('Dark Mode', '', theme === 'dark', () => setTheme('dark'), 'moon')}
          </View>
        </View>

        <View style={styles.section}>
          {renderSectionHeader('About')}
          <View style={[styles.cardGroup, { borderColor: colors.border }]}>
            <View style={[styles.optionRow, { backgroundColor: colors.card, borderBottomColor: 'transparent' }]}>
              <View style={styles.optionLabelRow}>
                <Feather name="info" size={18} color={colors.foreground} style={styles.optionIcon} />
                <Text style={[styles.optionText, { color: colors.foreground }]}>Version</Text>
              </View>
              <Text style={[styles.optionValueText, { color: colors.mutedForeground }]}>
                {Application.nativeApplicationVersion || '1.0.0'}
              </Text>
            </View>
          </View>
        </View>
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 8,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  optionValueText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});
