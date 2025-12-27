import React from 'react';
import { useNavigate } from 'react-router-dom';

function PrivacyPolicy() {
  const navigate = useNavigate();
  const effectiveDate = "January 1, 2025";

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      lineHeight: '1.6',
      color: '#333'
    }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{
          padding: '10px 20px',
          marginBottom: '20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        ← Back
      </button>

      <h1 style={{ color: '#4CAF50', marginBottom: '30px' }}>Privacy Policy</h1>
      <p style={{ fontStyle: 'italic', marginBottom: '30px' }}>Effective Date: {effectiveDate}</p>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>1. Information We Collect</h2>
        <h3>Personal Information:</h3>
        <ul>
          <li>Email address (for account creation)</li>
          <li>Name (optional)</li>
          <li>ZIP code (for shopping features)</li>
          <li>Payment information (processed securely through third-party providers)</li>
        </ul>
        
        <h3>Profile Information:</h3>
        <ul>
          <li>Household size and composition</li>
          <li>Dietary preferences and restrictions</li>
          <li>Budget information</li>
          <li>Cooking skill level and available tools</li>
          <li>Food preferences and dislikes</li>
        </ul>

        <h3>Usage Data:</h3>
        <ul>
          <li>Meal plans created</li>
          <li>Shopping lists generated</li>
          <li>Pantry items tracked</li>
          <li>App usage patterns</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide personalized meal planning services</li>
          <li>Generate customized shopping lists</li>
          <li>Process payments and manage subscriptions</li>
          <li>Improve our AI algorithms and service quality</li>
          <li>Send service-related communications</li>
          <li>Respond to customer support requests</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>3. Information Sharing</h2>
        <p><strong>We DO NOT sell your personal information.</strong></p>
        <p>We may share your information with:</p>
        <ul>
          <li>Service providers (payment processors, authentication services)</li>
          <li>Shopping partners (only with your explicit consent)</li>
          <li>Legal authorities (when required by law)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>4. Data Storage and Security</h2>
        <ul>
          <li>Data is encrypted in transit and at rest</li>
          <li>We use secure cloud storage providers</li>
          <li>Access is restricted to authorized personnel only</li>
          <li>Regular security audits are performed</li>
          <li>We comply with industry-standard security practices</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your account and data</li>
          <li>Export your data in a portable format</li>
          <li>Opt-out of marketing communications</li>
          <li>Withdraw consent for data processing</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>6. Cookies and Tracking</h2>
        <p>We use cookies and similar technologies for:</p>
        <ul>
          <li>Session management and authentication</li>
          <li>Remembering your preferences</li>
          <li>Analytics to improve our service</li>
          <li>We do not use tracking for advertising purposes</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>7. Children's Privacy</h2>
        <p>
          The Weekly Dish is not intended for children under 13. We do not knowingly collect 
          personal information from children. If you believe we have collected information from 
          a child, please contact us immediately.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>8. Data Retention</h2>
        <ul>
          <li>Active account data is retained while your account is active</li>
          <li>Deleted account data is removed within 30 days</li>
          <li>Some data may be retained longer for legal compliance</li>
          <li>Anonymized data may be retained for analytics</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>9. Third-Party Services</h2>
        <p>We integrate with the following services:</p>
        <ul>
          <li><strong>Clerk:</strong> Authentication and user management</li>
          <li><strong>OpenAI:</strong> AI-powered meal planning</li>
          <li><strong>Walmart:</strong> Shopping integration (optional)</li>
          <li><strong>Payment Processors:</strong> Secure payment handling</li>
        </ul>
        <p>Each service has its own privacy policy. We encourage you to review them.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>10. International Users</h2>
        <p>
          The Weekly Dish is operated in the United States. If you use our service from outside 
          the US, your data may be transferred to and processed in the US.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant 
          changes via email or in-app notification. Continued use after changes constitutes acceptance.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>12. Contact Us</h2>
        <p>For privacy-related questions or requests:</p>
        <p>
          Email: privacy@theweeklydish.com<br/>
          Support: support@theweeklydish.com<br/>
          Website: www.theweeklydish.com
        </p>
      </section>

      <section style={{ 
        marginTop: '50px', 
        padding: '20px', 
        backgroundColor: '#f0f8f0', 
        borderRadius: '10px',
        border: '2px solid #4CAF50'
      }}>
        <h3 style={{ color: '#4CAF50' }}>Your Privacy Matters</h3>
        <p>
          <strong>Our Commitment:</strong>
        </p>
        <ul>
          <li>✅ We never sell your data</li>
          <li>🔒 Your information is encrypted and secure</li>
          <li>👤 You control your data</li>
          <li>🗑️ Delete your account anytime</li>
          <li>📧 No spam - only service updates</li>
        </ul>
      </section>
    </div>
  );
}

export default PrivacyPolicy;