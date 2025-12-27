import React from 'react';
import { SignIn } from '@clerk/clerk-react';

function CustomSignIn() {
  return (
    <div style={styles.container}>
      <div style={styles.logoContainer}>
        <img src="/logo.png" alt="The Weekly Dish" style={styles.logo} />
        <h1 style={styles.title}>The Weekly Dish</h1>
        <p style={styles.subtitle}>Your AI-Powered Meal Planning Assistant</p>
      </div>
      
      <SignIn 
        routing="path" 
        path="/sign-in" 
        afterSignInUrl="/auth-redirect"
        appearance={{
          elements: {
            rootBox: styles.signInBox,
            card: styles.card,
            headerTitle: { display: 'none' },
            headerSubtitle: { display: 'none' },
            socialButtonsBlockButton: styles.socialButton,
            socialButtonsBlockButtonText: styles.socialButtonText,
            dividerRow: styles.divider,
            formButtonPrimary: styles.primaryButton,
            footerActionLink: styles.link,
            identityPreviewText: styles.identityText,
            identityPreviewEditButtonIcon: styles.editIcon,
            formFieldLabel: styles.label,
            formFieldInput: styles.input,
            footer: styles.footer
          },
          layout: {
            socialButtonsPlacement: 'top',
            socialButtonsVariant: 'blockButton'
          },
          variables: {
            colorPrimary: '#4CAF50',
            colorText: '#333',
            colorTextSecondary: '#666',
            colorBackground: '#fff',
            colorInputBackground: '#f5f5f5',
            colorInputText: '#333',
            borderRadius: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }
        }}
      />
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: '20px'
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  logo: {
    width: '80px',
    height: '80px',
    marginBottom: '10px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: '10px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: '0'
  },
  signInBox: {
    width: '100%',
    maxWidth: '400px'
  },
  card: {
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    borderRadius: '12px',
    padding: '30px'
  },
  socialButton: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '10px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      borderColor: '#999'
    }
  },
  socialButtonText: {
    color: '#333',
    fontWeight: '500'
  },
  divider: {
    margin: '20px 0'
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#45a049'
    }
  },
  link: {
    color: '#4CAF50',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  },
  identityText: {
    color: '#333'
  },
  editIcon: {
    color: '#4CAF50'
  },
  label: {
    color: '#333',
    fontWeight: '500',
    marginBottom: '5px'
  },
  input: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '16px',
    '&:focus': {
      borderColor: '#4CAF50',
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(76, 175, 80, 0.1)'
    }
  },
  footer: {
    marginTop: '20px'
  }
};

export default CustomSignIn;