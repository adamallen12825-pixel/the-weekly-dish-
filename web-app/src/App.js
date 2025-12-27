import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, UserButton, useUser, useClerk } from '@clerk/clerk-react';
import Dashboard from './components/Dashboard';
import ProfileSetupPage from './components/ProfileSetupPage';
import ProtectedRoute from './components/ProtectedRoute';
import AuthRedirect from './components/AuthRedirect';
import Subscribe from './components/Subscribe';
import PaymentSuccess from './components/PaymentSuccess';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import SharedMealPlan from './components/SharedMealPlan';
import CustomSignIn from './components/CustomSignIn';
import CustomSignUp from './components/CustomSignUp';
import kvService from './services/kvService';
import './App.css';

// Clerk publishable key - set in environment variables
const CLERK_PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsudGhld2Vla2x5LWRpc2guY29tJA';

function HomePage() {
  
  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.logoContainer}>
          <img src="/logo.png" alt="The Weekly Dish" style={styles.logoImage} />
          <h1 style={styles.logo}>The Weekly Dish</h1>
        </div>
        <div style={styles.navRight}>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <a href="/sign-in" style={styles.navLink}>Sign In</a>
          </SignedOut>
        </div>
      </nav>

      <div style={styles.hero}>
        <h2 style={styles.heroTitle}>Smart Meal Planning Made Simple</h2>
        <p style={styles.heroSubtitle}>
          Save time, money, and eat better with personalized meal plans
        </p>
        
        <SignedIn>
          <div style={styles.ctaContainer}>
            <a href="/dashboard" style={styles.ctaButton}>
              Go to Dashboard
            </a>
            <p style={styles.ctaText}>Access all features - No payment required</p>
          </div>
        </SignedIn>
        
        <SignedOut>
          <div style={styles.ctaContainer}>
            <a href="/sign-up" style={styles.ctaButton}>
              Sign Up - It's Free!
            </a>
            <p style={styles.ctaText}>Create your account to get started</p>
            <div style={{marginTop: '10px'}}>
              <a href="/sign-in" style={{...styles.ctaButton, backgroundColor: 'transparent', color: '#4CAF50', border: '2px solid #4CAF50'}}>
                Already have an account? Sign In
              </a>
            </div>
          </div>
        </SignedOut>
      </div>

      <div style={styles.features}>
        <h3>Everything You Need</h3>
        <div style={styles.featureGrid}>
          <div style={styles.feature}>
            <h4>Smart Meal Planning</h4>
            <p>Get personalized weekly meal plans based on your preferences and budget</p>
          </div>
          <div style={styles.feature}>
            <h4>Pantry Management</h4>
            <p>Track what you have and get recipes that use your ingredients</p>
          </div>
          <div style={styles.feature}>
            <h4>Shopping Lists</h4>
            <p>Automated shopping lists with Walmart integration for easy ordering</p>
          </div>
          <div style={styles.feature}>
            <h4>Budget Tracking</h4>
            <p>Stay within budget with cost-optimized meal suggestions</p>
          </div>
        </div>
      </div>


      <footer style={styles.footer}>
        <div style={styles.footerLinks}>
          <a href="/terms" style={styles.footerLink}>Terms of Service</a>
          <span style={{margin: '0 10px', color: '#999'}}>|</span>
          <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>
        </div>
        <p style={styles.footerText}>© 2025 The Weekly Dish. All rights reserved.</p>
        <p style={styles.footerBeta}>
          🚀 Currently in Beta - Free to use! Subscription ($9.99/month) coming soon.
        </p>
      </footer>
    </div>
  );
}

// Component to handle initial setup
function InitialSetup() {
  return null; // Removed cache clearing - it was causing performance issues
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <Router>
        <InitialSetup />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route 
            path="/sign-in/*" 
            element={<CustomSignIn />} 
          />
          <Route 
            path="/sign-up/*" 
            element={<CustomSignUp />} 
          />
          <Route 
            path="/subscribe" 
            element={
              <SignedIn>
                <Subscribe />
              </SignedIn>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute requireProfile={true}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/profile-setup" 
            element={
              <ProtectedRoute requireProfile={false}>
                <ProfileSetupPage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/profile-update" 
            element={
              <SignedIn>
                <ProfileSetupPage />
              </SignedIn>
            }
          />
          <Route 
            path="/auth-redirect" 
            element={
              <AuthRedirect />
            }
          />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/shared/:shareId" element={<SharedMealPlan />} />
        </Routes>
      </Router>
    </ClerkProvider>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoImage: {
    height: '40px',
    width: '40px',
    objectFit: 'contain',
  },
  logo: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4CAF50',
    margin: 0,
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  navLink: {
    color: '#333',
    textDecoration: 'none',
    fontWeight: '500',
  },
  hero: {
    textAlign: 'center',
    padding: '80px 20px',
    backgroundColor: '#f8f9fa',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '20px',
  },
  heroSubtitle: {
    fontSize: '20px',
    color: '#666',
    marginBottom: '40px',
  },
  ctaContainer: {
    marginTop: '40px',
  },
  ctaButton: {
    display: 'inline-block',
    padding: '15px 40px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'background-color 0.3s',
  },
  ctaText: {
    marginTop: '15px',
    color: '#666',
    fontSize: '14px',
  },
  features: {
    padding: '80px 40px',
    textAlign: 'center',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '40px',
    marginTop: '40px',
    maxWidth: '1200px',
    margin: '40px auto 0',
  },
  feature: {
    textAlign: 'left',
  },
  download: {
    padding: '80px 40px',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
  },
  downloadButton: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '15px 40px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: 'white',
    textDecoration: 'none',
    border: '2px solid #4CAF50',
    borderRadius: '8px',
  },
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  footer: {
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: '#2c3e50',
    color: 'white',
  },
  footerLinks: {
    marginBottom: '20px',
  },
  footerLink: {
    color: '#4CAF50',
    textDecoration: 'none',
    fontSize: '14px',
  },
  footerText: {
    color: '#999',
    fontSize: '14px',
    margin: '10px 0',
  },
  footerBeta: {
    color: '#4CAF50',
    fontSize: '13px',
    fontWeight: 'bold',
    marginTop: '10px',
  },
};

export default App;