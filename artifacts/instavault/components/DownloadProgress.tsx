import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

interface DownloadProgressProps {
  progress: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  fileName: string;
}

export function DownloadProgress({ progress, status, fileName }: DownloadProgressProps) {
  const colors = useColors();
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withTiming(progress, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [progress, widthAnim]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${widthAnim.value}%`,
    };
  });

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return '#10b981'; // Green
      case 'failed': return colors.destructive;
      case 'cancelled': return colors.mutedForeground;
      default: return colors.primary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
          {fileName}
        </Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {status === 'downloading' ? `${Math.round(progress)}%` : status.toUpperCase()}
        </Text>
      </View>
      
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        <Animated.View 
          style={[
            styles.fill, 
            { backgroundColor: getStatusColor() },
            progressStyle
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileName: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginRight: 12,
  },
  statusText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
