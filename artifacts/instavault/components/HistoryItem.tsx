import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { DownloadRecord } from '../services/database';
import { formatDistanceToNow } from 'date-fns';

interface HistoryItemProps {
  item: DownloadRecord;
}

export function HistoryItem({ item }: HistoryItemProps) {
  const colors = useColors();
  
  const isFailed = item.status === 'failed';
  const isVideo = item.mediaType === 'video' || item.mediaType === 'reel';
  const isCarousel = item.mediaType === 'carousel';

  return (
    <Link href={`/download/${item.id}`} asChild>
      <TouchableOpacity style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.7}>
        <View style={styles.thumbnailContainer}>
          <Image 
            source={{ uri: item.thumbnailUrl }} 
            style={[styles.thumbnail, { backgroundColor: colors.muted }]} 
            contentFit="cover"
          />
          <View style={styles.mediaTypeBadge}>
            <Feather 
              name={isVideo ? 'video' : isCarousel ? 'layers' : 'image'} 
              size={12} 
              color="#ffffff" 
            />
          </View>
        </View>
        
        <View style={styles.info}>
          <Text style={[styles.author, { color: colors.foreground }]} numberOfLines={1}>
            {item.authorDisplayName || item.author}
          </Text>
          
          <Text style={[styles.caption, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.caption || 'No caption'}
          </Text>
          
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatDistanceToNow(new Date(item.downloadedAt), { addSuffix: true })}
            </Text>
            
            {isFailed ? (
              <View style={styles.statusBadge}>
                <Feather name="alert-circle" size={12} color={colors.destructive} />
                <Text style={[styles.statusText, { color: colors.destructive }]}>Failed</Text>
              </View>
            ) : item.savedToGallery ? (
              <View style={styles.statusBadge}>
                <Feather name="check" size={12} color="#10b981" />
                <Text style={[styles.statusText, { color: '#10b981' }]}>Saved</Text>
              </View>
            ) : (
              <View style={styles.statusBadge}>
                <Feather name="file" size={12} color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.primary }]}>File</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 16,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  mediaTypeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  author: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});
