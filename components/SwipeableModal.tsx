import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StyleProp,
  ViewStyle,
  Platform,
  Keyboard,
  BackHandler,
} from 'react-native';
import { Colors, Shadows, Radius } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SwipeableModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  showHandle?: boolean;
}

export default function SwipeableModal({
  visible,
  onClose,
  children,
  maxHeight = SCREEN_HEIGHT * 0.85,
  style,
  contentStyle,
  showHandle = true,
}: SwipeableModalProps) {
  const [internalVisible, setInternalVisible] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [kbHeight, setKbHeight] = useState(0);

  // Android hardware back button handler
  useEffect(() => {
    if (!internalVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true; // prevent exit app
    });
    return () => sub.remove();
  }, [internalVisible]);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) => setKbHeight(e.endCoordinates?.height || 0);
    const onHide = () => setKbHeight(0);
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // Buka animasi slide up saat visible = true
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setInternalVisible(false);
      onClose();
    });
  };

  // PanResponder untuk swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Hanya tangkap pergeseran vertikal ke bawah
        return gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        // Jika ditarik > 70px atau di-flick ke bawah dengan kecepatan > 0.4
        if (gesture.dy > 70 || gesture.vy > 0.4) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 45,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={s.overlay} pointerEvents="box-none">
        {/* Transparent backdrop */}
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* Animated Sheet — terangkat otomatis saat keyboard muncul */}
        <Animated.View
          style={[
            s.sheet,
            {
              maxHeight: kbHeight > 0
                ? Math.min(maxHeight, SCREEN_HEIGHT - kbHeight - 40)
                : maxHeight,
              paddingBottom: kbHeight > 0 ? kbHeight + 16 : 0,
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          {/* Drag Handle & Gesture Area */}
          <View {...panResponder.panHandlers} style={s.dragZone}>
            {showHandle && <View style={s.handle} />}
          </View>

          {/* Sheet Content */}
          <View style={[s.content, contentStyle]}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent', // BEBAS BACKGROUND HITAM!
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 2,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.clayFloat,
    elevation: 24, // Strong elevation on Android agar kontras tanpa backdrop gelap
  },
  dragZone: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderDark,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
