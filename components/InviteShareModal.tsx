import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Linking,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeableModal from './SwipeableModal';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

interface InviteShareModalProps {
  visible: boolean;
  onClose: () => void;
  inviteLink: string;
  workspaceName: string;
}

export default function InviteShareModal({
  visible,
  onClose,
  inviteLink,
  workspaceName,
}: InviteShareModalProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const shareTitle = `Gabung ke dompet "${workspaceName}" di Dompet Bareng`;
  const shareText = `${shareTitle}:\n${inviteLink}`;

  const handleCopy = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        // Fallback: trigger Share on native if clipboard unavailable
        // (expo-clipboard not installed — keep deps minimal)
        await Share.share({ message: inviteLink });
        return;
      }
    } catch {
      // textarea fallback for older browsers
      try {
        const ta = document.createElement('textarea');
        ta.value = inviteLink;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    if (Platform.OS !== 'web') Vibration.vibrate(50);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteLink]);

  const openWhatsApp = () => {
    Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`);
  };

  const openTelegram = () => {
    Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareTitle)}`);
  };

  const openEmail = () => {
    Linking.openURL(`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText)}`);
  };

  const openNativeShare = async () => {
    try {
      const content = Platform.select({
        ios: { url: inviteLink, title: shareTitle } as any,
        default: { message: shareText, title: shareTitle },
      });
      await Share.share(content);
    } catch {}
  };

  return (
    <SwipeableModal visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerIconWrap}>
          <Ionicons name="link-outline" size={24} color={Colors.primary} />
        </View>
        <Text style={s.title}>{t('inviteModalTitle')}</Text>
        <Text style={s.subtitle}>{t('inviteModalSubtitle')}</Text>
      </View>

      {/* Link Box + Copy */}
      <View style={s.linkRow}>
        <View style={s.linkBox}>
          <Text style={s.linkText} numberOfLines={1} ellipsizeMode="middle">
            {inviteLink}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.copyBtn, copied && s.copyBtnDone]}
          onPress={handleCopy}
          activeOpacity={0.8}
        >
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={18}
            color={copied ? '#fff' : Colors.primary}
          />
          <Text style={[s.copyBtnText, copied && s.copyBtnTextDone]}>
            {copied ? t('linkCopied') : t('copyLink')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Share Grid */}
      <View style={s.shareGrid}>
        <TouchableOpacity style={s.shareItem} onPress={openWhatsApp} activeOpacity={0.7}>
          <View style={[s.shareIcon, { backgroundColor: '#E7F5EC' }]}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
          </View>
          <Text style={s.shareLabel}>{t('shareViaWhatsApp')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.shareItem} onPress={openTelegram} activeOpacity={0.7}>
          <View style={[s.shareIcon, { backgroundColor: '#E8F4FD' }]}>
            <Ionicons name="paper-plane-outline" size={22} color="#0088cc" />
          </View>
          <Text style={s.shareLabel}>{t('shareViaTelegram')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.shareItem} onPress={openEmail} activeOpacity={0.7}>
          <View style={[s.shareIcon, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="mail-outline" size={22} color="#E5832A" />
          </View>
          <Text style={s.shareLabel}>{t('shareViaEmail')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.shareItem} onPress={openNativeShare} activeOpacity={0.7}>
          <View style={[s.shareIcon, { backgroundColor: Colors.primarySoft }]}>
            <Ionicons name="share-social-outline" size={22} color={Colors.primary} />
          </View>
          <Text style={s.shareLabel}>{t('shareViaOther')}</Text>
        </TouchableOpacity>
      </View>

      {/* Note */}
      <View style={s.noteRow}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
        <Text style={s.noteText}>{t('inviteNote')}</Text>
      </View>
    </SwipeableModal>
  );
}

const s = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadows.clayButton,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  linkBox: {
    flex: 1,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  copyBtnDone: {
    backgroundColor: Colors.income,
    borderColor: Colors.income,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  copyBtnTextDone: {
    color: '#fff',
  },
  shareGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  shareItem: {
    alignItems: 'center',
    flex: 1,
  },
  shareIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...Shadows.card,
  },
  shareLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
});
