import { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';

import { useMotionAllowed } from '../../hooks/useReduceMotion';

const EMOJI = ['🎉', '🧺', '🌳'];

/**
 * The join celebration (design E3 success, DS section 13): three emoji rise and fade in
 * 500 ms. Nothing under reduced motion: the toast and the new state carry the news.
 * Decorative, hidden from screen readers.
 */
export function Confetti({ burst }: { burst: number }) {
  const motionAllowed = useMotionAllowed();
  const [progress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!burst || !motionAllowed) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [burst, motionAllowed, progress]);

  if (!burst || !motionAllowed) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="absolute bottom-24 left-0 right-0 flex-row justify-center gap-xl"
      testID="confetti"
    >
      {EMOJI.map((emoji, index) => (
        <Animated.View
          key={emoji}
          style={{
            opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -80 - index * 20],
                }),
              },
            ],
          }}
        >
          <Text className="text-[28px]">{emoji}</Text>
        </Animated.View>
      ))}
    </View>
  );
}
