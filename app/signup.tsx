import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { activateWithPassword, loginWithMicrosoft } from '@/services/auth';

const MICROSOFT_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/cancelled': 'Login cancelado.',
  'auth/network-error': 'Verifique sua conexão e tente novamente.',
};

export default function SignupScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loading = microsoftLoading || activateLoading;

  async function handleMicrosoftLogin() {
    setMicrosoftLoading(true);
    try {
      await loginWithMicrosoft();
      router.replace('/success');
    } catch (error) {
      const err = error as { code?: string };
      const code = err?.code ?? '';
      const message =
        MICROSOFT_ERROR_MESSAGES[code] ??
        (err instanceof Error ? err.message : 'Falha ao entrar com Microsoft. Tente novamente.');
      Alert.alert('Erro', message);
    } finally {
      setMicrosoftLoading(false);
    }
  }

  async function handleActivateWithPassword() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setActivateLoading(true);
    try {
      await activateWithPassword(trimmedEmail, password);
      router.replace('/success');
    } catch (error) {
      const err = error as { code?: string };
      const message =
        err?.code === 'auth/email-already-in-use'
          ? 'Este e-mail já está em uso. Tente fazer login.'
          : err?.code === 'auth/weak-password'
            ? 'Escolha uma senha mais forte.'
            : 'Falha ao ativar cadastro. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setActivateLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.topLeftSemiContainer}>
              <Image
                source={require('@/assets/top_left_semi.png')}
                style={styles.topLeftSemi}
                contentFit="contain"
              />
            </View>
            <View style={styles.logoRow}>
              <Image
                source={require('@/assets/hywork_logo.png')}
                style={styles.hyworkLogo}
                contentFit="contain"
              />
            </View>
            <Pressable style={styles.backLink} onPress={() => router.replace('/(tabs)')}>
              <MaterialIcons name="arrow-back" size={20} color="#627D98" />
              <Text style={styles.backLinkText}>Acessar minha conta</Text>
            </Pressable>
            <Text style={styles.heading}>Ative seu cadastro</Text>
            <Text style={styles.subtitle}>
              Confirme seu acesso e escolha como fazer login
            </Text>
            <Pressable
              style={[styles.microsoftButton, loading && styles.microsoftButtonDisabled]}
              onPress={handleMicrosoftLogin}
              disabled={loading}>
              {microsoftLoading ? (
                <ActivityIndicator color="#1E3A5F" />
              ) : (
                <Image
                  source={require('@/assets/microsoft_logo.png')}
                  style={styles.microsoftLogo}
                  contentFit="contain"
                />
              )}
            </Pressable>
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OU ENTRE COM E-MAIL</Text>
              <View style={styles.orLine} />
            </View>
            <View style={styles.formContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Luiza@hyworkclous.com.br"
                placeholderTextColor="#8C98A5"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() =>
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
                }
              />
              <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••••••"
                  placeholderTextColor="#8C98A5"
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() =>
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
                  }
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setPasswordVisible((v) => !v)}
                  hitSlop={12}>
                  <MaterialIcons
                    name={passwordVisible ? 'visibility-off' : 'visibility'}
                    size={22}
                    color="#8C98A5"
                  />
                </Pressable>
              </View>
              <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
                Confirmar senha
              </Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••••••"
                  placeholderTextColor="#8C98A5"
                  secureTextEntry={!confirmPasswordVisible}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() =>
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)
                  }
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setConfirmPasswordVisible((v) => !v)}
                  hitSlop={12}>
                  <MaterialIcons
                    name={confirmPasswordVisible ? 'visibility-off' : 'visibility'}
                    size={22}
                    color="#8C98A5"
                  />
                </Pressable>
              </View>
              <Pressable
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleActivateWithPassword}
                disabled={loading}>
                {activateLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Ativar com senha</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 8,
  },
  topLeftSemiContainer: {
    position: 'absolute',
    top: -4,
    left: -12,
    zIndex: 0,
  },
  topLeftSemi: {
    width: 100,
    height: 100,
  },
  logoRow: {
    marginLeft: 28,
    marginTop: 72,
    marginBottom: 8,
    zIndex: 1,
  },
  hyworkLogo: {
    width: 174,
    height: 69,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 28,
    marginTop: 20,
    gap: 8,
    zIndex: 1,
  },
  backLinkText: {
    fontFamily: 'Montserrat',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    color: '#627D98',
  },
  heading: {
    marginTop: 24,
    marginHorizontal: 28,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 28,
    color: '#2D3748',
    zIndex: 1,
  },
  subtitle: {
    marginTop: 8,
    marginHorizontal: 28,
    fontFamily: 'Montserrat',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#627D98',
    zIndex: 1,
  },
  microsoftButton: {
    marginTop: 20,
    marginHorizontal: 28,
    height: 56,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE1E5',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  microsoftButtonDisabled: {
    opacity: 0.6,
  },
  microsoftLogo: {
    width: 280,
    height: 40,
  },
  orDivider: {
    marginTop: 20,
    marginHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 1,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#DDE1E5',
  },
  orText: {
    fontFamily: 'Montserrat',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0,
    color: '#8C98A5',
    fontVariant: ['small-caps'],
  },
  formContainer: {
    marginTop: 20,
    marginHorizontal: 28,
    zIndex: 1,
  },
  fieldLabel: {
    fontFamily: 'Montserrat',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
    color: '#2D3748',
    marginBottom: 12,
  },
  fieldLabelSpacing: {
    marginTop: 20,
  },
  input: {
    fontFamily: 'Montserrat',
    fontSize: 16,
    color: '#2D3748',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE1E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: 32,
    backgroundColor: '#1E3A5F',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: 'Montserrat',
    fontWeight: '700',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
