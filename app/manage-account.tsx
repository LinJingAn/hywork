import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CORE_API_BASE, DEFAULT_TENANT_ID } from '@/config/auth';
import { auth } from '@/config/firebase';
import {
  getStoredAuthContext,
  parseApiErrorMessage,
  refreshAuthContextWithFirebase,
} from '@/services/auth';

type Screen = 'main' | 'password';

function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.backButton} hitSlop={12} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color="#1E293B" />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

const MIN_PASSWORD_LENGTH = 6;

function MainScreen({
  onChangePassword,
  userEmail,
}: {
  onChangePassword: () => void;
  userEmail: string | null;
}) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>
        Faça alterações nas suas informações pessoas{'\n'}ou no tipo de conta
      </Text>

      <Text style={styles.sectionTitle}>Informações pessoas</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>E-mail</Text>
        <Text style={styles.rowValue}>{userEmail ?? '—'}</Text>
      </View>
      <View style={styles.separator} />

      <Pressable style={styles.row} onPress={onChangePassword}>
        <Text style={styles.rowLabel}>Senha</Text>
        <View style={styles.rowRight}>
          <Text style={styles.rowAction}>Mudar senha</Text>
          <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
        </View>
      </Pressable>
      <View style={styles.separator} />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Notificações</Text>
        <View style={styles.rowRight}>
          <Text style={styles.toggleLabel}>
            {notificationsEnabled ? 'Ativo' : 'Inativo'}
          </Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#E5E7EB', true: '#F97316' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function PasswordScreen({ onBack }: { onBack: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!currentPassword.trim()) {
      setError('Informe a senha atual.');
      return;
    }
    if (!newPassword.trim()) {
      setError('Informe a nova senha.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não conferem.');
      return;
    }

    const context = await getStoredAuthContext();
    if (!context?.token) {
      setError('Sessão inválida. Faça login novamente.');
      return;
    }

    let baseTenantId = context.tenantId || DEFAULT_TENANT_ID;
    let collabId = context.collabId;

    if (!collabId || !baseTenantId) {
      const refreshed = await refreshAuthContextWithFirebase();
      if (refreshed) {
        baseTenantId = refreshed.tenantId || DEFAULT_TENANT_ID || baseTenantId;
        collabId = refreshed.collabId ?? collabId;
      }
    }

    if (!collabId || !baseTenantId) {
      setError('Sessão incompleta. Faça login novamente.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${CORE_API_BASE}/collabs/${encodeURIComponent(collabId)}/password`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${context.token}`,
            'Content-Type': 'application/json',
            'x-tenant-id': baseTenantId,
          },
          body: JSON.stringify({
            currentPassword: currentPassword.trim(),
            newPassword: newPassword.trim(),
          }),
        }
      );

      if (!response.ok) {
        const raw = await response.text();
        const parsed = raw ? JSON.parse(raw) : {};
        const apiMsg = parseApiErrorMessage(parsed);
        setError(apiMsg || 'Não foi possível alterar a senha. Tente novamente.');
        return;
      }

      Alert.alert(
        'Senha alterada',
        'Sua senha foi alterada com sucesso. Use a nova senha no próximo login.',
        [{ text: 'OK', onPress: onBack }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, onBack]);

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>
        Faça alterações nas suas informações pessoas{'\n'}ou no tipo de conta
      </Text>

      <Text style={styles.sectionTitle}>Senha</Text>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.inputLabel}>Senha atual</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Digite sua senha atual"
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showCurrent}
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <Pressable hitSlop={12} onPress={() => setShowCurrent(!showCurrent)}>
          <Ionicons
            name={showCurrent ? 'eye-outline' : 'eye-off-outline'}
            size={22}
            color="#94A3B8"
          />
        </Pressable>
      </View>

      <Text style={styles.inputLabel}>Nova senha</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Crie uma senha forte"
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showNew}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Pressable hitSlop={12} onPress={() => setShowNew(!showNew)}>
          <Ionicons
            name={showNew ? 'eye-outline' : 'eye-off-outline'}
            size={22}
            color="#94A3B8"
          />
        </Pressable>
      </View>

      <Text style={styles.inputLabel}>Confirmar senha</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Confirme a senha"
          placeholderTextColor="#94A3B8"
          secureTextEntry={!showConfirm}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable hitSlop={12} onPress={() => setShowConfirm(!showConfirm)}>
          <Ionicons
            name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
            size={22}
            color="#94A3B8"
          />
        </Pressable>
      </View>

      <Pressable
        style={[styles.doneButton, loading && styles.doneButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#1E293B" />
        ) : (
          <Text style={styles.doneButtonText}>Feito</Text>
        )}
      </Pressable>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export default function ManageAccountScreen() {
  const [screen, setScreen] = useState<Screen>('main');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const email = auth.currentUser?.email ?? null;
    setUserEmail(email);
  }, []);

  function handleBack() {
    if (screen === 'password') {
      setScreen('main');
    } else {
      try {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/success');
        }
      } catch {
        router.replace('/success');
      }
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Gerenciar conta" onBack={handleBack} />
      {screen === 'main' ? (
        <MainScreen
          onChangePassword={() => setScreen('password')}
          userEmail={userEmail}
        />
      ) : (
        <PasswordScreen onBack={() => setScreen('main')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
  },
  rowValue: {
    fontSize: 14,
    color: '#94A3B8',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowAction: {
    fontSize: 14,
    color: '#94A3B8',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginRight: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  doneButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonDisabled: {
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  bottomSpacer: {
    height: 40,
  },
});
