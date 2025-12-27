import React, { useState } from 'react';
import { SignUp } from '@clerk/clerk-react';

function SignUpWrapper() {
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSignUp = (e) => {
    if (!tosAccepted) {
      e.preventDefault();
      e.stopPropagation();
      setShowError(true);
      return false;
    }
    setShowError(false);
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.signUpWrapper}>
        <SignUp 
          routing="path" 
          path="/sign-up" 
          afterSignUpUrl="/auth-redirect"
        />
        
        <div style={styles.tosContainer}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => {
                setTosAccepted(e.target.checked);
                setShowError(false);
              }}
              style={styles.checkbox}
            />
            <span>
              I agree to the{' '}
              <a href="/terms" target="_blank" style={styles.link}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" style={styles.link}>
                Privacy Policy
              </a>
            </span>
          </label>
          
          {showError && (
            <div style={styles.errorMessage}>
              ⚠️ You must accept the Terms of Service to create an account
            </div>
          )}
          
          <div style={styles.betaNotice}>
            <strong>🚀 Beta Notice:</strong> The Weekly Dish is currently free during beta testing. 
            A $9.99/month subscription will be required after beta ends (with advance notice).
          </div>
        </div>

        <div 
          onClick={handleSignUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: tosAccepted ? 'none' : 'auto',
            backgroundColor: tosAccepted ? 'transparent' : 'rgba(255, 255, 255, 0)',
            cursor: tosAccepted ? 'default' : 'not-allowed',
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  signUpWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px'
  },
  tosContainer: {
    maxWidth: '400px',
    marginTop: '20px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    fontSize: '14px',
    lineHeight: '1.5',
    cursor: 'pointer'
  },
  checkbox: {
    marginRight: '10px',
    marginTop: '4px',
    cursor: 'pointer',
    width: '18px',
    height: '18px'
  },
  link: {
    color: '#4CAF50',
    textDecoration: 'underline'
  },
  errorMessage: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '5px',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  betaNotice: {
    marginTop: '15px',
    padding: '12px',
    backgroundColor: '#e8f4fd',
    border: '1px solid #0071ce',
    borderRadius: '5px',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#333'
  }
};

export default SignUpWrapper;