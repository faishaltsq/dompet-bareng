import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWorkspace } from '@/context/WorkspaceContext';
import { parseTransaction, chatWithContext, isAIAvailable, ParsedTransaction } from '@/lib/gemini';
import { formatRupiah, getCategoryMeta } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';
import {
  evaluateCompanion,
  QUICK_CHIPS,
  MASCOT_IMAGES,
  CompanionState,
  FinancialSnapshot,
  MascotMood,
  QuickChipId,
  getFallbackChipResponse,
  getFallbackFreeResponse,
} from '@/lib/companion';

const MASCOT_SIZE = 72;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function MascotOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeWorkspace, transactions, summary } = useWorkspace();

  const snap: FinancialSnapshot = useMemo(() => {
    const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});
    return {
      income: summary.income,
      expense: summary.expense,
      balance: summary.balance,
      count: transactions.length,
      byCategory,
    };
  }, [transactions, summary]);

  const companion: CompanionState = useMemo(() => evaluateCompanion(snap), [snap]);

  const [modalVisible, setModalVisible] = useState(false);
  const [speech, setSpeech] = useState<string>(companion.greeting);
  const [lastUserPrompt, setLastUserPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [parsedTx, setParsedTx] = useState<ParsedTransaction | null>(null);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null); // null = belum dicek

  // Cek koneksi AI saat modal dibuka
  useEffect(() => {
    if (modalVisible) {
      isAIAvailable().then(setAiOnline);
    }
  }, [modalVisible]);

  // Tooltip mini auto-popup
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const prevMoodRef = useRef<MascotMood>(companion.mood);

  useEffect(() => {
    if (prevMoodRef.current !== companion.mood) {
      prevMoodRef.current = companion.mood;
      setTooltipText(companion.greeting.slice(0, 60) + '...');
      const timer = setTimeout(() => setTooltipText(null), 15000);
      return () => clearTimeout(timer);
    }
  }, [companion.mood, companion.greeting]);

  // Track sisi dock secara reaktif agar tooltip tidak terpotong
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');

  // Posisi default kanan bawah
  const defaultX = SCREEN_WIDTH - MASCOT_SIZE - 16;
  const defaultY = SCREEN_HEIGHT - MASCOT_SIZE - 96 - (insets.bottom || 16);

  // PanResponder native RN (bebas dependency crash di RN 0.86)
  const pan = useRef(new RNAnimated.ValueXY({ x: defaultX, y: defaultY })).current;
  const panCurrent = useRef({ x: defaultX, y: defaultY });

  useEffect(() => {
    const id = pan.addListener(value => {
      panCurrent.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Hanya mulai drag jika pergeseran > 6px agar tap tetap responsif
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: panCurrent.current.x,
          y: panCurrent.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const currentX = panCurrent.current.x;
        const currentY = panCurrent.current.y;

        // Auto-dock ke tepi layar terdekat
        const midX = SCREEN_WIDTH / 2;
        const targetX = currentX < midX ? 16 : SCREEN_WIDTH - MASCOT_SIZE - 16;
        setDockSide(currentX < midX ? 'left' : 'right');

        const minY = (insets.top || 20) + 10;
        const maxY = SCREEN_HEIGHT - MASCOT_SIZE - (insets.bottom || 20) - 70;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        RNAnimated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          friction: 6,
          tension: 40,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Sheet drag down to dismiss
  const sheetTranslateY = useRef(new RNAnimated.Value(0)).current;

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.4) {
          RNAnimated.timing(sheetTranslateY, {
            toValue: SCREEN_HEIGHT,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setModalVisible(false);
            sheetTranslateY.setValue(0);
          });
        } else {
          RNAnimated.spring(sheetTranslateY, {
            toValue: 0,
            friction: 7,
            tension: 45,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animasi mood mascot
  const moodScale = useSharedValue(1);
  const moodRotate = useSharedValue(0);

  useEffect(() => {
    if (companion.mood === 'HAPPY') {
      moodScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
      moodRotate.value = 0;
    } else if (companion.mood === 'PANIC') {
      moodRotate.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 100 }),
          withTiming(4, { duration: 100 }),
          withTiming(0, { duration: 100 })
        ),
        -1,
        true
      );
      moodScale.value = withRepeat(
        withSequence(withTiming(1.06, { duration: 300 }), withTiming(1, { duration: 300 })),
        -1,
        true
      );
    } else if (companion.mood === 'WARNING') {
      moodRotate.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 400 }),
          withTiming(2, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1,
        true
      );
      moodScale.value = 1;
    } else {
      moodScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
      moodRotate.value = 0;
    }
  }, [companion.mood]);

  const animatedMoodStyle = useAnimatedStyle(() => ({
    transform: [{ scale: moodScale.value }, { rotate: `${moodRotate.value}deg` }],
  }));

  // AI Chat & Quick Chips Handler
  const triggerAi = async (promptText: string, chipId?: QuickChipId) => {
    setLoading(true);
    setLastUserPrompt(promptText);
    setParsedTx(null);

    // Jika AI offline → pakai template fallback
    if (aiOnline === false) {
      const reply = chipId
        ? getFallbackChipResponse(chipId, snap, companion.mood)
        : getFallbackFreeResponse(promptText, snap, companion.mood);
      setSpeech(reply);
      setLoading(false);
      return;
    }

    try {
      const txSummary = {
        totalIncome: snap.income,
        totalExpense: snap.expense,
        balance: snap.balance,
        byCategory: snap.byCategory,
        count: snap.count,
      };

      const history = lastUserPrompt
        ? [
            { role: 'user' as const, content: lastUserPrompt },
            { role: 'assistant' as const, content: speech },
          ]
        : [];

      const reply = await chatWithContext(promptText, txSummary, history);
      setSpeech(reply);
    } catch (e: any) {
      // AI gagal → fallback ke template
      setAiOnline(false);
      const reply = chipId
        ? getFallbackChipResponse(chipId, snap, companion.mood)
        : getFallbackFreeResponse(promptText, snap, companion.mood);
      setSpeech(reply);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    // Jika AI online & input mengandung nominal → coba parse transaksi
    if (aiOnline !== false) {
      const hasNumber = /\d/.test(text) || /\b(ribu|ratus|jt|rb|k)\b/i.test(text);
      if (hasNumber) {
        setLoading(true);
        try {
          const parsed = await parseTransaction(text);
          setParsedTx(parsed);
          const meta = getCategoryMeta(parsed.category);
          setSpeech(
            `${meta.emoji} Transaksi terdeteksi!\n${parsed.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'} ${formatRupiah(parsed.amount)} untuk ${parsed.category}.\n\nTekan tombol di bawah untuk simpan ya!`
          );
          setLastUserPrompt(text);
          setLoading(false);
          return;
        } catch {
          // parse gagal → lanjut ke triggerAi
        }
      }
    }

    await triggerAi(text);
  };

  const handleApplyParsed = () => {
    if (!parsedTx) return;
    setModalVisible(false);
    router.push({
      pathname: '/modal',
      params: {
        type: parsedTx.type,
        amount: parsedTx.amount.toString(),
        category: parsedTx.category,
        description: parsedTx.description,
      },
    });
    setParsedTx(null);
  };

  if (!activeWorkspace) return null;

  const mascotSource = MASCOT_IMAGES[companion.mood] || MASCOT_IMAGES.NEUTRAL;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Floating Draggable Mascot via native PanResponder */}
      <RNAnimated.View
        style={[
          s.mascotAnchor,
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Tooltip bubble — ikut posisi mascot, muncul di sisi yg tepat */}
        {tooltipText && !modalVisible && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[
              s.tooltipBubble,
              Shadows.card,
              dockSide === 'left'
                ? { left: MASCOT_SIZE + 8 }   // dock kiri → bubble ke kanan
                : { right: MASCOT_SIZE + 8 },  // dock kanan → bubble ke kiri
              { top: MASCOT_SIZE / 2 - 20 },
            ]}
            pointerEvents="none"
          >
            <Text style={s.tooltipText} numberOfLines={3}>
              {tooltipText}
            </Text>
          </Animated.View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setTooltipText(null);
            setSpeech(companion.greeting);
            setModalVisible(true);
          }}
          style={s.mascotTouch}
        >
          <Animated.View
            style={[
              s.mascotHalo,
              animatedMoodStyle,
              {
                borderColor: companion.color,
                backgroundColor: companion.softColor,
              },
            ]}
          >
            <Image source={mascotSource} style={s.mascotImage} resizeMode="contain" />
          </Animated.View>
        </TouchableOpacity>
      </RNAnimated.View>

      {/* ── Bottom Sheet Interactive Companion Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          <RNAnimated.View
            style={[
              s.bottomSheet,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View {...sheetPanResponder.panHandlers} style={s.dragHandleArea}>
              <View style={s.dragHandle} />
            </View>

            {/* Header: Otter Lucu + Status Finansial */}
            <View style={s.sheetHeader}>
              <View style={s.mascotHeaderLeft}>
                <Image source={mascotSource} style={s.sheetMascotImg} resizeMode="contain" />
                <View>
                  <Text style={s.sheetTitle}>Otter Finansial</Text>
                  <Text style={[s.sheetMood, { color: companion.color }]}>
                    {companion.moodLabel} • {companion.statusLabel}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={s.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Offline / Checking Banner */}
            {aiOnline === null && (
              <View style={s.aiBanner}>
                <ActivityIndicator size="small" color={Colors.textMuted} />
                <Text style={s.aiBannerText}>Otter Finansial AI sedang disiapkan...</Text>
              </View>
            )}
            {aiOnline === false && (
              <View style={[s.aiBanner, s.aiBannerOffline]}>
                <Text style={s.aiBannerIcon}>🔧</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.aiBannerText, s.aiBannerTextOffline]}>Otter Finansial AI sedang maintenance</Text>
                  <Text style={s.aiBannerSub}>Tenang, aku tetap bisa analisis dompetmu pakai chip di atas!</Text>
                </View>
              </View>
            )}

            {/* Scroll Content: Bubble + Chips + Action Card */}
            <ScrollView
              style={s.sheetScroll}
              contentContainerStyle={s.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                key={speech}
                entering={FadeInDown.duration(250)}
                style={[s.speechBubble, Shadows.card]}
              >
                {loading ? (
                  <View style={s.loadingRow}>
                    <ActivityIndicator size="small" color={companion.color} />
                    <Text style={s.loadingText}>Otter sedang memikirkan dompetmu...</Text>
                  </View>
                ) : (
                  <Text style={s.speechText}>{speech}</Text>
                )}

                {lastUserPrompt && (
                  <View style={s.lastPromptRow}>
                    <Text style={s.lastPromptLabel}>Pertanyaan kamu:</Text>
                    <Text style={s.lastPromptText} numberOfLines={1}>
                      "{lastUserPrompt}"
                    </Text>
                  </View>
                )}
              </Animated.View>

              {parsedTx && (
                <Animated.View entering={FadeInUp.duration(250)} style={s.actionCard}>
                  <View style={s.actionCardHeader}>
                    <Text style={s.actionCardTitle}>⚡ Catat Cepat</Text>
                    <TouchableOpacity onPress={() => setParsedTx(null)}>
                      <Text style={s.actionCardClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.actionDetailRow}>
                    <Text style={s.actionDetailLabel}>Kategori / Nominal:</Text>
                    <Text style={s.actionDetailValueBold}>
                      {parsedTx.category} • {formatRupiah(parsedTx.amount)}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.actionCardBtn} onPress={handleApplyParsed}>
                    <Text style={s.actionCardBtnText}>＋ Masukkan ke Form Transaksi</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              <View style={s.chipsWrap}>
                <Text style={s.chipsHeader}>TANYA CEPAT</Text>
                <View style={s.chipsRow}>
                  {QUICK_CHIPS.map(chip => (
                    <TouchableOpacity
                      key={chip.id}
                      style={s.chipBtn}
                      onPress={() => triggerAi(chip.prompt, chip.id as QuickChipId)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text style={s.chipText}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Input Dock */}
            <View style={s.inputDock}>
              <TextInput
                style={[s.inputField, aiOnline === false && s.inputFieldDisabled]}
                placeholder={aiOnline === false ? 'Otter AI sedang maintenance — pilih chip di atas' : 'Ketik transaksi / tanya keuangan...'}
                placeholderTextColor={Colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!loading && aiOnline !== false}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading || aiOnline === false) && s.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || loading || aiOnline === false}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.sendBtnText}>↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </RNAnimated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  mascotAnchor: {
    position: 'absolute',
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    zIndex: 9999,
  },
  mascotTouch: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotHalo: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    borderRadius: MASCOT_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.float,
  },
  mascotImage: {
    width: MASCOT_SIZE - 6,
    height: MASCOT_SIZE - 6,
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeEmoji: {
    fontSize: 12,
  },

  tooltipBubble: {
    position: 'absolute',
    width: 200,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 9998,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
    lineHeight: 17,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: SCREEN_HEIGHT * 0.65,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandleArea: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderDark,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  mascotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetMascotImg: {
    width: 48,
    height: 48,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  sheetMood: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  sheetScroll: {
    maxHeight: 320,
    marginVertical: 12,
  },
  sheetScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },

  speechBubble: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  speechText: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textDark,
    fontWeight: '500',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  lastPromptRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  lastPromptLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  lastPromptText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  actionCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 8,
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  actionCardClose: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  actionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionDetailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionDetailValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  actionCardBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  actionCardBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  chipsWrap: {
    gap: 6,
  },
  chipsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDark,
  },

  inputDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputField: {
    flex: 1,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 13,
    color: Colors.textDark,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: -2,
  },

  // AI Status Banner
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  aiBannerOffline: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  aiBannerIcon: {
    fontSize: 18,
  },
  aiBannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  aiBannerTextOffline: {
    color: '#E65100',
    fontWeight: '700',
  },
  aiBannerSub: {
    fontSize: 11,
    color: '#BF360C',
    marginTop: 1,
  },
  inputFieldDisabled: {
    backgroundColor: Colors.cardAlt,
    opacity: 0.6,
  },
});
