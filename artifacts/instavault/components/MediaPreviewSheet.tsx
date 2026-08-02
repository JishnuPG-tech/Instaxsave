import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { MediaInfo, MediaFormat } from '@workspace/api-client-react';

interface MediaPreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  media: MediaInfo | null;
  onDownload: (formatId: string, index?: number) => void;
  defaultQuality: string;
}

export function MediaPreviewSheet({ visible, onClose, media, onDownload, defaultQuality }: MediaPreviewSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedFormat, setSelectedFormat] = useState<string>(defaultQuality);

  const formats = media?.formats || media?.items?.[0]?.formats || [];

  // Must be before any early return — hooks cannot be conditional
  React.useEffect(() => {
    if (visible && formats.length > 0) {
      const match = formats.find(f => f.formatId === defaultQuality);
      setSelectedFormat(match ? defaultQuality : formats[0].formatId);
    }
  }, [visible, formats, defaultQuality]);

  if (!media) return null;
  
  const handleDownload = () => {
    onDownload(selectedFormat);
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={[
          styles.sheet, 
          { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }
        ]}>
          <View style={styles.handle} />
          
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.header}>
              <Image 
                source={{ uri: media.thumbnailUrl || undefined }} 
                style={[styles.thumbnail, { backgroundColor: colors.muted }]} 
                contentFit="cover"
                transition={200}
              />
              <View style={styles.headerText}>
                <View style={styles.authorRow}>
                  {media.authorAvatarUrl && (
                    <Image source={{ uri: media.authorAvatarUrl }} style={styles.avatar} />
                  )}
                  <Text style={[styles.authorName, { color: colors.foreground }]} numberOfLines={1}>
                    {media.authorDisplayName || media.author}
                  </Text>
                </View>
                <View style={styles.mediaTypeBadge}>
                  <Feather 
                    name={
                      media.type === 'video' || media.type === 'reel' ? 'video' : 
                      media.type === 'carousel' ? 'layers' : 'image'
                    } 
                    size={12} 
                    color={colors.primaryForeground} 
                  />
                  <Text style={[styles.mediaTypeText, { color: colors.primaryForeground }]}>
                    {media.type.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            
            {media.caption && (
              <Text style={[styles.caption, { color: colors.mutedForeground }]} numberOfLines={3}>
                {media.caption}
              </Text>
            )}
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quality</Text>
            
            <View style={styles.formatList}>
              {formats.map((format) => (
                <TouchableOpacity
                  key={format.formatId}
                  style={[
                    styles.formatOption,
                    { borderColor: colors.border },
                    selectedFormat === format.formatId && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
                  ]}
                  onPress={() => setSelectedFormat(format.formatId)}
                >
                  <View style={styles.formatInfo}>
                    <Text style={[
                      styles.formatLabel, 
                      { color: selectedFormat === format.formatId ? colors.primary : colors.foreground }
                    ]}>
                      {format.label}
                    </Text>
                    <Text style={[styles.formatDetails, { color: colors.mutedForeground }]}>
                      {format.ext.toUpperCase()} {format.filesize ? `• ${(format.filesize / 1024 / 1024).toFixed(1)}MB` : ''}
                    </Text>
                  </View>
                  {selectedFormat === format.formatId && (
                    <Feather name="check-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              style={[styles.downloadButton, { backgroundColor: colors.primary }]}
              onPress={handleDownload}
              activeOpacity={0.8}
            >
              <Feather name="download" size={20} color={colors.primaryForeground} />
              <Text style={[styles.downloadButtonText, { color: colors.primaryForeground }]}>
                Download Now
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  content: {
    padding: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginRight: 16,
  },
  headerText: {
    flex: 1,
    justifyContent: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    flex: 1,
  },
  mediaTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#8b5cf6', // using primary explicitly here for the badge
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  mediaTypeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 12,
  },
  formatList: {
    gap: 12,
    marginBottom: 32,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  formatInfo: {
    flex: 1,
  },
  formatLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  formatDetails: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
  downloadButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});
