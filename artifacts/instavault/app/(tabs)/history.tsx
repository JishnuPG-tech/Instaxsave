import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useColors } from '@/hooks/useColors';
import { DownloadRecord, getDownloads, searchDownloads } from '@/services/database';
import { HistoryItem } from '@/components/HistoryItem';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Videos' },
  { id: 'photo', label: 'Photos' },
  { id: 'audio', label: 'Audio' }
];

export default function History() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  
  const loadData = useCallback(() => {
    if (Platform.OS !== 'web') {
      if (searchQuery.trim().length > 0) {
        setHistory(searchDownloads(searchQuery.trim()));
      } else {
        setHistory(getDownloads(50, 0, {
          mediaType: activeFilter === 'all' ? undefined : activeFilter,
        }));
      }
    }
  }, [searchQuery, activeFilter]);
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const renderItem = useCallback(({ item }: { item: DownloadRecord }) => (
    <HistoryItem item={item} />
  ), []);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Feather name="inbox" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No downloads found</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {searchQuery ? 'Try a different search term' : 'Your downloaded media will appear here'}
      </Text>
    </View>
  ), [colors, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>History</Text>
      </View>
      
      <View style={styles.controls}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={20} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search downloads..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
        
        {!searchQuery && (
          <View style={styles.filtersContainer}>
            <FlashList
              data={FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              estimatedItemSize={80}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => {
                const isActive = activeFilter === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      { 
                        backgroundColor: isActive ? colors.primary : colors.card,
                        borderColor: isActive ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => setActiveFilter(item.id)}
                  >
                    <Text style={[
                      styles.filterText,
                      { color: isActive ? colors.primaryForeground : colors.foreground }
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>
      
      <View style={[styles.listContainer, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 84) }]}>
        <FlashList
          data={history}
          renderItem={renderItem}
          estimatedItemSize={106}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 }}
          ListEmptyComponent={ListEmptyComponent}
        />
      </View>
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
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  controls: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  filtersContainer: {
    height: 36,
  },
  filterChip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});
