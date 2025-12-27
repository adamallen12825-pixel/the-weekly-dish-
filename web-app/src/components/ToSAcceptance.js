import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import kvService from '../services/kvService';

function ToSAcceptance() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!accepted) {
      alert('You must accept the Terms of Service to continue using The Weekly Dish');
      return;
    }

    setLoading(true);
    
    const acceptanceData = {
      tosAccepted: true,
      tosAcceptedDate: new Date().toISOString(),
      tosVersion: '1.0',
      userEmail: user?.primaryEmailAddress?.emailAddress || user?.email
    };
    
    // Save to CLOUD STORAGE - tied to the ACCOUNT, not the device
    try {
      await kvService.set(user.id, 'tosAcceptance', acceptanceData);
      console.log('ToS acceptance saved to cloud');
    } catch (error) {
      console.error('Error saving ToS to cloud:', error);
    }
    
    // Also try to save to Clerk metadata (may fail due to permissions)
    try {
      await user.update({
        publicMetadata: {
          ...user.publicMetadata,
          ...acceptanceData
        }
      });
      await user.reload();
    } catch (error) {
      console.error('Error saving to Clerk (non-fatal):', error);
      // Continue anyway - cloud storage has the acceptance
    }
    
    // Redirect to profile setup for new users
    window.location.href = '/profile-setup';
  };

  const handleDecline = () => {
    if (window.confirm('If you decline the Terms of Service, you will not be able to use The Weekly Dish. Are you sure?')) {
      // Sign them out
      window.location.href = '/';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <img src="/logo.png" alt="The Weekly Dish" style={styles.logo} />
          <h1 style={styles.title}>Terms of Service Update</h1>
        </div>

        <div style={styles.content}>
          <div style={styles.notice}>
            <h2>Important Notice</h2>
            <p>
              We've updated our Terms of Service and Privacy Policy. Please review and accept them to continue using The Weekly Dish.
            </p>
          </div>

          <div style={styles.keyPoints}>
            <h3>Key Points:</h3>
            <ul>
              <li>✅ <strong>Currently FREE during beta testing</strong></li>
              <li>💳 <strong>$9.99/month subscription after beta ends</strong> (you'll be notified 7 days before)</li>
              <li>🤖 AI-generated meal plans and recommendations</li>
              <li>🔒 Your data is secure and never sold</li>
              <li>🛒 Optional Walmart integration for shopping</li>
              <li>❌ Cancel anytime before billing begins</li>
            </ul>
          </div>

          <div style={styles.betaNotice}>
            <strong>Beta Testing Agreement:</strong>
            <p>
              By continuing, you understand that The Weekly Dish is in beta testing. 
              The service is currently free but will transition to a paid subscription 
              ($9.99/month) after beta testing concludes. You will receive advance notice 
              before any charges begin and can cancel at any time.
            </p>
          </div>

          <div style={styles.documents}>
            <p>Please review the full documents:</p>
            <div style={styles.docLinks}>
              <a href="/terms" target="_blank" style={styles.docLink}>
                📄 Read Terms of Service
              </a>
              <a href="/privacy" target="_blank" style={styles.docLink}>
                🔒 Read Privacy Policy
              </a>
            </div>
          </div>

          <div style={styles.acceptance}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={styles.checkboxInput}
              />
              <span>
                I have read and accept the Terms of Service and Privacy Policy. 
                I understand that The Weekly Dish will become a paid service after beta testing.
              </span>
            </label>
          </div>

          <div style={styles.actions}>
            <button
              onClick={handleDecline}
              style={styles.declineButton}
              disabled={loading}
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              style={{
                ...styles.acceptButton,
                opacity: accepted ? 1 : 0.6,
                cursor: accepted ? 'pointer' : 'not-allowed'
              }}
              disabled={loading || !accepted}
            >
              {loading ? 'Processing...' : 'Accept and Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '15px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
  },
  header: {
    padding: '30px',
    textAlign: 'center',
    borderBottom: '2px solid #f0f0f0'
  },
  logo: {
    width: '60px',
    height: '60px',
    marginBottom: '15px'
  },
  title: {
    color: '#4CAF50',
    margin: 0,
    fontSize: '28px'
  },
  content: {
    padding: '30px'
  },
  notice: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '25px'
  },
  keyPoints: {
    marginBottom: '25px'
  },
  betaNotice: {
    backgroundColor: '#e8f4fd',
    border: '1px solid #0071ce',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '25px'
  },
  documents: {
    marginBottom: '25px',
    textAlign: 'center'
  },
  docLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '15px'
  },
  docLink: {
    padding: '10px 20px',
    backgroundColor: '#f8f9fa',
    border: '2px solid #4CAF50',
    borderRadius: '8px',
    color: '#4CAF50',
    textDecoration: 'none',
    fontWeight: 'bold',
    transition: 'background-color 0.3s'
  },
  acceptance: {
    marginBottom: '25px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'flex-start',
    cursor: 'pointer',
    lineHeight: '1.5'
  },
  checkboxInput: {
    marginRight: '10px',
    marginTop: '4px',
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px'
  },
  declineButton: {
    flex: 1,
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: 'white',
    color: '#dc3545',
    border: '2px solid #dc3545',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  acceptButton: {
    flex: 2,
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    transition: 'opacity 0.3s'
  }
};

export default ToSAcceptance;