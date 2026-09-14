import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, { SlideInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications, AppNotification } from '@/context/NotificationContext';
import { Colors, Shadows, Radius } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  const handleOpenDetail = async (item: AppNotification) => {
    setSelectedNotif(item);
    if (!item.is_read) {
      await markAsRead(item.id);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays === 1) return 'Kemarin';
      if (diffDays < 7) return `${diffDays} hari lalu`;
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <Animated.View
          entering={SlideInDown.springify()}
          style={[s.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          {/* DRAG HANDLE */}
          <View style={s.sheetHandle} />

          {/* HEADER */}
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <View style={s.iconWrapper}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary }}>!</Text>
              </View>
              <View>
                <Text style={s.headerTitle}>Notifikasi</Text>
                <Text style={s.headerSubtitle}>
                  {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => markAllAsRead()}
                  style={s.markAllBtn}
                  activeOpacity={0.7}
                >
                  <Text style={s.markAllBtnText}>Tandai Dibaca</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CONTENT LIST */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {loading && notifications.length === 0 ? (
              <View style={s.emptyBox}>
                <ActivityIndicator color={Colors.primary} size="small" />
                <Text style={s.emptySubtext}>Memuat notifikasi...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 30, marginBottom: 8, fontWeight: '700', color: Colors.textMuted }}>—</Text>
                <Text style={s.emptyTitle}>Belum Ada Notifikasi</Text>
                <Text style={s.emptySubtext}>
                  Pemberitahuan terkait aktivitas dompetmu akan muncul di sini.
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                const isKicked = item.type === 'member_kicked';
                const notifIcon = isKicked ? '!' : 'i';

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.notifCard, !item.is_read && s.notifCardUnread]}
                    onPress={() => handleOpenDetail(item)}
                    activeOpacity={0.8}
                  >
                    {/* ICON TYPE */}
                    <View
                      style={[
                        s.typeIconBox,
                        isKicked ? s.typeIconBoxWarning : s.typeIconBoxInfo,
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>{notifIcon}</Text>
                    </View>

                    {/* TEXT BODY */}
                    <View style={{ flex: 1 }}>
                      <View style={s.notifHeaderRow}>
                        <Text
                          style={[s.notifTitle, !item.is_read && s.notifTitleBold]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={s.notifTime}>{formatRelativeTime(item.created_at)}</Text>
                      </View>
                      <Text
                        style={[s.notifMessage, !item.is_read && s.notifMessageUnread]}
                        numberOfLines={2}
                      >
                        {item.message}
                      </Text>
                    </View>

                    {/* UNREAD BLUE DOT */}
                    {!item.is_read && <View style={s.unreadDot} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Animated.View>

        {/* ── DETAIL MODAL OVERLAY ── */}
        {selectedNotif && (
          <Modal
            visible={Boolean(selectedNotif)}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedNotif(null)}
          >
            <View style={s.detailOverlay}>
              <Animated.View entering={FadeIn.duration(200)} style={s.detailCard}>
                <View style={s.detailTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={[
                        s.typeIconBox,
                        selectedNotif.type === 'member_kicked'
                          ? s.typeIconBoxWarning
                          : s.typeIconBoxInfo,
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>
                        {selectedNotif.type === 'member_kicked' ? '!' : 'i'}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.detailTitle}>{selectedNotif.title}</Text>
                      <Text style={s.detailTime}>
                        {new Date(selectedNotif.created_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedNotif(null)}
                    style={s.detailCloseBtn}
                  >
                    <Text style={s.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* WORKSPACE BADGE */}
                {selectedNotif.data?.workspace_name && (
                  <View style={s.workspaceBadge}>
                    <Text style={s.workspaceBadgeText}>
                      Dompet: {selectedNotif.data.workspace_name}
                    </Text>
                  </View>
                )}

                {/* FULL MESSAGE */}
                <Text style={s.detailBodyText}>{selectedNotif.message}</Text>

                {/* REASON CARD (IF KICKED) */}
                {selectedNotif.data?.reason ? (
                  <View style={s.reasonBox}>
                    <Text style={s.reasonLabel}>Catatan dari Pengurus/Admin:</Text>
                    <Text style={s.reasonText}>"{selectedNotif.data.reason}"</Text>
                    {selectedNotif.data?.admin_name ? (
                      <Text style={s.reasonAuthor}>— {selectedNotif.data.admin_name}</Text>
                    ) : null}
                  </View>
                ) : null}

                <TouchableOpacity
                  style={s.detailDoneBtn}
                  onPress={() => setSelectedNotif(null)}
                >
                  <Text style={s.detailDoneBtnText}>Tutup</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: SCREEN_HEIGHT * 0.8,
    paddingHorizontal: 18,
    paddingTop: 10,
    ...Shadows.card,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  markAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 10,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  notifCardUnread: {
    backgroundColor: '#F3FAF7', // subtle primary soft tint
    borderColor: Colors.primarySoft,
  },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBoxWarning: {
    backgroundColor: Colors.accentOrangeSoft,
  },
  typeIconBoxInfo: {
    backgroundColor: Colors.accentBlueSoft,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 13,
    color: Colors.textDark,
    fontWeight: '600',
    flex: 1,
  },
  notifTitleBold: {
    fontWeight: '800',
    color: Colors.textDark,
  },
  notifTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  notifMessageUnread: {
    color: Colors.textDark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },

  // Detail Modal Styles
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  detailCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadows.card,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textDark,
  },
  detailTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  workspaceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: 12,
  },
  workspaceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  detailBodyText: {
    fontSize: 13,
    color: Colors.textDark,
    lineHeight: 18,
    marginBottom: 14,
  },
  reasonBox: {
    backgroundColor: Colors.accentOrangeSoft,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accentOrange,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.textDark,
    lineHeight: 18,
  },
  reasonAuthor: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'right',
    fontWeight: '600',
  },
  detailDoneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailDoneBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
