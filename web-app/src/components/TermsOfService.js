import React from 'react';
import { useNavigate } from 'react-router-dom';

function TermsOfService() {
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

      <h1 style={{ color: '#4CAF50', marginBottom: '30px' }}>Terms of Service</h1>
      <p style={{ fontStyle: 'italic', marginBottom: '30px' }}>Effective Date: {effectiveDate}</p>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>1. Acceptance of Terms</h2>
        <p>
          By accessing or using The Weekly Dish ("Service"), you agree to be bound by these Terms of Service. 
          If you do not agree to these terms, please do not use our Service.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>2. Beta Testing Period</h2>
        <p>
          <strong>IMPORTANT NOTICE:</strong> The Weekly Dish is currently in beta testing. By using the Service during this period:
        </p>
        <ul>
          <li>You acknowledge that the Service is provided free of charge during the testing phase</li>
          <li>You understand that subscription fees will be implemented upon completion of beta testing</li>
          <li>You will be notified at least 7 days before billing begins</li>
          <li>Current planned subscription rate is $9.99/month (subject to change)</li>
          <li>You may cancel your account at any time before billing begins</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>3. Description of Service</h2>
        <p>
          The Weekly Dish provides:
        </p>
        <ul>
          <li>AI-powered meal planning based on dietary preferences and budget</li>
          <li>Automated shopping list generation</li>
          <li>Pantry management tools</li>
          <li>Recipe storage and recommendations</li>
          <li>Integration with third-party services (such as Walmart) for shopping convenience</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>4. User Accounts</h2>
        <p>To use our Service, you must:</p>
        <ul>
          <li>Be at least 18 years old or have parental consent</li>
          <li>Provide accurate and complete information</li>
          <li>Maintain the security of your account credentials</li>
          <li>Notify us immediately of any unauthorized access</li>
          <li>Be responsible for all activities under your account</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>5. Subscription and Payment</h2>
        <p>
          Once beta testing concludes:
        </p>
        <ul>
          <li>A monthly subscription fee will be required to continue using the Service</li>
          <li>Payment will be processed monthly in advance</li>
          <li>Subscription automatically renews unless cancelled</li>
          <li>You may cancel your subscription at any time</li>
          <li>No refunds for partial months</li>
          <li>We reserve the right to change pricing with 30 days notice</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>6. User Content and Data</h2>
        <p>
          By using our Service:
        </p>
        <ul>
          <li>You retain ownership of your personal data and content</li>
          <li>You grant us license to use your data to provide and improve the Service</li>
          <li>Your meal preferences and dietary information will be used to generate personalized recommendations</li>
          <li>We will not sell your personal data to third parties</li>
          <li>You can request deletion of your data at any time</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>7. AI-Generated Content Disclaimer</h2>
        <p>
          <strong>IMPORTANT:</strong> The Weekly Dish uses AI technology to generate meal plans and recommendations:
        </p>
        <ul>
          <li>AI-generated content is for informational purposes only</li>
          <li>Always verify nutritional information and allergen warnings</li>
          <li>Consult healthcare providers for specific dietary needs</li>
          <li>We are not responsible for allergic reactions or dietary issues</li>
          <li>Generated prices are estimates and may vary from actual store prices</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>8. Third-Party Services</h2>
        <p>
          Our Service integrates with third-party providers:
        </p>
        <ul>
          <li>Walmart and other retailers for shopping functionality</li>
          <li>Payment processors for subscription billing</li>
          <li>These services have their own terms and privacy policies</li>
          <li>We are not responsible for third-party service availability or accuracy</li>
          <li>Product availability and pricing subject to retailer policies</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>9. Prohibited Uses</h2>
        <p>
          You agree not to:
        </p>
        <ul>
          <li>Use the Service for any illegal purpose</li>
          <li>Share your account with others</li>
          <li>Attempt to reverse engineer or hack the Service</li>
          <li>Scrape or copy content for commercial purposes</li>
          <li>Misrepresent AI-generated content as professional dietary advice</li>
          <li>Use the Service to harm or mislead others</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>10. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW:
        </p>
        <ul>
          <li>The Service is provided "AS IS" without warranties</li>
          <li>We are not liable for any indirect, incidental, or consequential damages</li>
          <li>We are not responsible for food safety, allergic reactions, or dietary outcomes</li>
          <li>Our total liability shall not exceed the amount paid for the Service</li>
          <li>Some jurisdictions do not allow these limitations</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>11. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless The Weekly Dish, its affiliates, and employees from any claims, 
          damages, or expenses arising from your use of the Service or violation of these Terms.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>12. Termination</h2>
        <p>
          We reserve the right to:
        </p>
        <ul>
          <li>Suspend or terminate your account for violation of these Terms</li>
          <li>Discontinue the Service with 30 days notice</li>
          <li>Delete inactive accounts after 12 months</li>
        </ul>
        <p>
          You may delete your account at any time through the app settings.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>13. Changes to Terms</h2>
        <p>
          We may update these Terms at any time. We will notify you of material changes via email or in-app notification. 
          Continued use of the Service after changes constitutes acceptance of new Terms.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>14. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the United States. Any disputes shall be resolved through binding 
          arbitration, except where prohibited by law.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>15. Contact Information</h2>
        <p>
          For questions about these Terms, please contact us at:
        </p>
        <p>
          Email: support@theweeklydish.com<br/>
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
        <h3 style={{ color: '#4CAF50' }}>Summary for Beta Users</h3>
        <p>
          <strong>Key Points:</strong>
        </p>
        <ul>
          <li>✅ Free during beta testing</li>
          <li>💳 $9.99/month subscription after beta (with advance notice)</li>
          <li>🤖 AI-generated content - verify important information</li>
          <li>🛒 Third-party shopping integration</li>
          <li>🔒 Your data is yours - we don't sell it</li>
          <li>❌ Cancel anytime</li>
        </ul>
      </section>
    </div>
  );
}

export default TermsOfService;