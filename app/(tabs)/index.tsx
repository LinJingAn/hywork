import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/config/firebase';
import { isNewUser, loginWithEmail, loginWithMicrosoft } from '@/services/auth';

const INVALID_CREDENTIAL_MESSAGE =
  'Não foi possível fazer login. Verifique se o e-mail e a senha estão corretos, ou crie uma nova conta.';

const NEW_USER_SIGNUP_MESSAGE =
  'Você é novo por aqui. Vamos levá-lo à página de cadastro.';

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  'auth/popup-blocked': 'Pop-up bloqueado. Habilite pop-ups para esta página.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/cancelled-popup-request': 'Login cancelado.',
  'auth/cancelled': 'Login cancelado.',
  'auth/account-exists-with-different-credential':
    'Este e-mail já está em uso com outro método de login.',
  'auth/network-error': 'Verifique sua conexão e tente novamente.',
};

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loading = emailLoading || microsoftLoading;

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Erro', 'Preencha e-mail e senha.');
      return;
    }

    setEmailLoading(true);
    try {
      await loginWithEmail(trimmedEmail, password);
      router.replace('/success');
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/user-not-found') {
        Alert.alert('Conta não encontrada', NEW_USER_SIGNUP_MESSAGE, [
          { text: 'OK', onPress: () => router.replace({ pathname: '/signup', params: { email: trimmedEmail } }) },
        ]);
        return;
      }
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password'
      ) {
        Alert.alert('Erro no login', INVALID_CREDENTIAL_MESSAGE, [
          { text: 'Tentar novamente', style: 'cancel' },
          { text: 'Criar conta', onPress: () => router.replace({ pathname: '/signup', params: { email: trimmedEmail } }) },
        ]);
        return;
      }

      const fallback = 'Falha ao fazer login. Tente novamente.';
      const message =
        FIREBASE_ERROR_MESSAGES[code] ??
        ((error as Error)?.message && (error as Error).message !== fallback
          ? (error as Error).message
          : fallback);
      Alert.alert('Erro', message);
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleMicrosoftLogin() {
    setMicrosoftLoading(true);
    try {
      await loginWithMicrosoft();
      const user = auth.currentUser;
      if (user && isNewUser(user)) {
        Alert.alert('Conta não encontrada', NEW_USER_SIGNUP_MESSAGE, [
          { text: 'OK', onPress: () => router.replace({ pathname: '/signup', params: { email: user.email ?? '' } }) },
        ]);
      } else {
        router.replace('/success');
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? '';
      const message = FIREBASE_ERROR_MESSAGES[code] ?? 'Falha ao entrar com Microsoft. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setMicrosoftLoading(false);
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
            <View style={styles.topSection}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/top_right_logo.png')}
                  style={styles.logo}
                  contentFit="contain"
                />
              </View>
              <View style={styles.hyworkLogoContainer}>
                <Image
                  source={require('@/assets/hywork_logo.png')}
                  style={styles.hyworkLogo}
                  contentFit="contain"
                />
                <Text style={styles.accessAccountText}>Acesse sua conta</Text>
                <Text style={styles.intranetText}>Intranet Corporativa Hywork</Text>
              </View>
            </View>
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
                placeholder="Name@example.com"
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
              <Pressable
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}>
                {emailLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar na conta</Text>
                )}
              </Pressable>
              <Pressable style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
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
  },
  topSection: {
    height: 300,
  },
  logoContainer: {
    position: 'absolute',
    top: 32,
    right: 0,
  },
  logo: {
    width: 97,
    height: 138,
    opacity: 1,
  },
  hyworkLogoContainer: {
    position: 'absolute',
    left: 21,
    top: 126,
  },
  hyworkLogo: {
    width: 174,
    height: 69,
    opacity: 1,
  },
  accessAccountText: {
    marginTop: 32,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: 0,
  },
  intranetText: {
    marginTop: 8,
    fontFamily: 'Montserrat',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    color: '#627D98',
  },
  microsoftButton: {
    marginTop: 12,
    marginHorizontal: 30,
    height: 56,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  microsoftButtonDisabled: {
    opacity: 0.6,
  },
  microsoftLogo: {
    width: 340,
    height: 56,
  },
  orDivider: {
    marginTop: 20,
    marginHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
    marginHorizontal: 30,
  },
  fieldLabel: {
    fontFamily: 'Montserrat',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
    color: '#2D3748',
    marginBottom: 8,
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
  loginButton: {
    marginTop: 24,
    alignSelf: 'stretch',
    height: 49,
    borderRadius: 8,
    backgroundColor: '#1E3A5F',
    opacity: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontFamily: 'Montserrat',
    fontWeight: '700',
    fontSize: 16,
    color: '#FFFFFF',
  },
  forgotLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    fontFamily: 'Montserrat',
    fontWeight: '400',
    fontSize: 14,
    color: '#8C98A5',
  },
});
