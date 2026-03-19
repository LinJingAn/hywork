import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
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

import { auth } from '@/config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const trimmed = email.trim();

    if (!trimmed) {
      setError('Informe seu e-mail para redefinição de senha.');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, trimmed);
      Alert.alert(
        'E-mail enviado',
        'Verifique sua caixa de entrada. Enviamos um link para redefinir sua senha.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'auth/user-not-found') {
        setError('Nenhuma conta encontrada com este e-mail.');
      } else if (e?.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError(e?.message || 'Não foi possível enviar o e-mail. Tente novamente.');
      }
    } finally {
      setLoading(false);
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
            <Pressable style={styles.backLink} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={20} color="#627D98" />
              <Text style={styles.backLinkText}>Acessar minha conta</Text>
            </Pressable>
            <Text style={styles.heading}>Esqueci minha senha</Text>
            <View style={styles.formContainer}>
              <Text style={styles.fieldLabel}>E-mail para redefinição de senha</Text>
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
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <Pressable
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar</Text>
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
  },
  formContainer: {
    marginTop: 32,
    marginHorizontal: 28,
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
  submitButton: {
    marginTop: 32,
    backgroundColor: '#1E3A5F',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontFamily: 'Montserrat',
    fontSize: 14,
    color: '#DC2626',
  },
  submitButtonText: {
    fontFamily: 'Montserrat',
    fontWeight: '700',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
