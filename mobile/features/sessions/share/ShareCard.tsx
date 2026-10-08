import { forwardRef, useMemo, type ComponentRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { renderCardSvg } from './renderCardSvg';
import type { CardOptions, SessionData } from './types';

export interface ShareCardProps {
  session: SessionData;
  options: CardOptions;
  width: number;
  photoUri?: string;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
  onLayout?: () => void;
}

/** Capture this node only. Keep the editor and checkerboard outside it. */
export const ShareCard = forwardRef<ComponentRef<typeof View>, ShareCardProps>(function ShareCard(
  { session, options, width, photoUri, onPhotoLoad, onPhotoError, onLayout }, ref,
) {
  const svg = useMemo(() => renderCardSvg(session, {
    ...options,
  }), [session, options]);
  const height = width * 16 / 9;
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={onLayout}
      accessible
      accessibilityLabel={`Production session. ${session.producerName}. ${Math.floor(session.durationSeconds / 60)} minutes.`}
      style={{ width, height, backgroundColor: 'transparent', overflow: 'hidden' }}
    >
      {options.template === 'photo' && photoUri ? (
        <Image
          key={photoUri}
          source={{ uri: photoUri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onLoad={onPhotoLoad}
          onError={onPhotoError}
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {/* Keyed per look: react-native-svg can keep a previous card's clip paths when only the
          markup changes, which made templates draw with another template's leftovers. */}
      <SvgXml
        key={`${options.template}-${options.monoTheme ?? ''}-${options.photoPosition ?? ''}`}
        xml={svg}
        width={width}
        height={height}
      />
    </View>
  );
});
