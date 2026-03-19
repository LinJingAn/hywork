import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

const HEADER_HEIGHT = 160;

const PENDING_INVITES = [
  { id: '1', name: 'Carlos Mendes', email: 'carlos.mendes@email.com', date: '20/02/2026' },
  { id: '2', name: 'Ana Souza', email: 'ana.souza@email.com', date: '18/02/2026' },
];

const ACCEPTED_INVITES = [
  { id: '3', name: 'João Silva', email: 'joao.silva@email.com', date: '10/01/2026', color: '#5B9BD5' },
  { id: '4', name: 'Maria Santos', email: 'maria.santos@email.com', date: '05/01/2026', color: '#D4A373' },
];

function PageHeader({ title }: { title: string }) {
  return (
    <LinearGradient
      colors={['#F472B6', '#EC4899', '#DB2777']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientHeader}
    >
      <View style={styles.headerNav}>
        <Pressable style={styles.backButton} hitSlop={12} onPress={() => {
          try {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/success');
            }
          } catch {
            router.replace('/success');
          }
        }}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.backButton} />
      </View>
    </LinearGradient>
  );
}

function InviteCard({
  name,
  email,
  date,
  color,
  pending,
}: {
  name: string;
  email: string;
  date: string;
  color?: string;
  pending?: boolean;
}) {
  return (
    <View style={styles.inviteCard}>
      <View style={[styles.inviteAvatar, { backgroundColor: color || '#E5E7EB' }]}>
        <Text style={styles.inviteInitial}>{name[0]}</Text>
      </View>
      <View style={styles.inviteInfo}>
        <Text style={styles.inviteName}>{name}</Text>
        <Text style={styles.inviteEmail}>{email}</Text>
        <Text style={styles.inviteDate}>
          {pending ? 'Enviado em ' : 'Aceito em '}
          {date}
        </Text>
      </View>
      {pending && (
        <View style={styles.statusBadgePending}>
          <Text style={styles.statusTextPending}>Pendente</Text>
        </View>
      )}
      {!pending && (
        <View style={styles.statusBadgeAccepted}>
          <Text style={styles.statusTextAccepted}>Aceito</Text>
        </View>
      )}
    </View>
  );
}

export default function InviteScreen() {
  const [email, setEmail] = useState('');

  return (
    <View style={styles.root}>
      <PageHeader title="Tela de Convite" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.inviteBox}>
          <View style={styles.inviteBoxIcon}>
            <MaterialIcons name="mail-outline" size={28} color="#EC4899" />
          </View>
          <Text style={styles.inviteBoxTitle}>Convidar colaborador</Text>
          <Text style={styles.inviteBoxDesc}>
            Envie um convite por e-mail para adicionar novos membros à sua equipe.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.emailInput}
              placeholder="Digite o e-mail"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Pressable style={styles.sendBtn}>
              <MaterialIcons name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Convites pendentes</Text>
          {PENDING_INVITES.map((invite) => (
            <InviteCard key={invite.id} {...invite} pending />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Convites aceitos</Text>
          {ACCEPTED_INVITES.map((invite) => (
            <InviteCard key={invite.id} {...invite} />
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  gradientHeader: {
    height: HEADER_HEIGHT,
    paddingTop: 56,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  inviteBox: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteBoxIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  inviteBoxTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  inviteBoxDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  emailInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inviteAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  inviteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  inviteName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  inviteEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  inviteDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTextPending: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  statusBadgeAccepted: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTextAccepted: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  bottomSpacer: {
    height: 40,
  },
});
