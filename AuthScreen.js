import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSignIn, useSignUp, useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import UserCounter from './UserCounter';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen({ setIsAuthenticated }) {
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isSignedIn) {
      setIsAuthenticated(true);
    }
  }, [isSignedIn]);

  const handleSignUpPress = async () => {
    if (!signUpLoaded) return;
    
    try {
      setLoading(true);
      // Clerk will open the sign-up page in a web browser
      await signUp.create({
        strategy: 'oauth_google',
      });
      
      // If sign up was successful, set the session as active
      if (signUp.createdSessionId) {
        await setSignUpActive({ session: signUp.createdSessionId });
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Sign up error:', err);
      // Try the hosted sign-up page as fallback
      await WebBrowser.openAuthSessionAsync(
        'https://lucky-wallaby-21.clerk.accounts.dev/sign-up',
        'theweeklydish://oauth-callback'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignInPress = async () => {
    if (!signInLoaded) return;

    try {
      setLoading(true);
      // Clerk will open the sign-in page in a web browser
      await signIn.create({
        strategy: 'oauth_google',
      });
      
      // If sign in was successful, set the session as active
      if (signIn.createdSessionId) {
        await setSignInActive({ session: signIn.createdSessionId });
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Sign in error:', err);
      // Try the hosted sign-in page as fallback
      await WebBrowser.openAuthSessionAsync(
        'https://lucky-wallaby-21.clerk.accounts.dev/sign-in',
        'theweeklydish://oauth-callback'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    try {
      setLoading(true);
      // Open Clerk's hosted sign-up page
      const result = await WebBrowser.openAuthSessionAsync(
        'https://lucky-wallaby-21.clerk.accounts.dev/sign-up',
        'theweeklydish://oauth-callback'
      );
      
      if (result.type === 'success') {
        // Check if we're now signed in
        if (isSignedIn) {
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error('Email sign up error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    try {
      setLoading(true);
      // Open Clerk's hosted sign-in page
      const result = await WebBrowser.openAuthSessionAsync(
        'https://lucky-wallaby-21.clerk.accounts.dev/sign-in',
        'theweeklydish://oauth-callback'
      );
      
      if (result.type === 'success') {
        // Check if we're now signed in
        if (isSignedIn) {
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error('Email sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <UserCounter />
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Authenticating...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UserCounter />
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>The Weekly Dish</Text>
        <Text style={styles.tagline}>Smart Meal Planning Made Easy</Text>
      </View>

      <View style={styles.authContainer}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>Sign in or create an account to get started</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleEmailSignUp}>
          <Text style={styles.primaryButtonText}>Sign Up - Start Free Trial</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleEmailSignIn}>
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleSignUpPress}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>$9.99/month after 7-day free trial</Text>
          <Text style={styles.infoText}>Cancel anytime</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  authContainer: {
    backgroundColor: '#f9f9f9',
    padding: 30,
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#666',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});