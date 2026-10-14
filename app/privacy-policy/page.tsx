export const metadata = {
  title: "Privacy Policy — FieldScore",
}

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#e0e0e0", backgroundColor: "#060B18", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>Last updated: September 2026</p>

      <p style={{ lineHeight: 1.7, marginBottom: 24 }}>
        SIMS INFOTECH (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the FieldScore mobile application and web platform. This Privacy Policy explains how we collect, use, and protect your information when you use our services.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>1. Information We Collect</h2>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Personal Information</h3>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li>Name, email address, and phone number (for user accounts)</li>
        <li>Organization details (company name)</li>
      </ul>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Location Data</h3>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li>Precise and approximate location data for attendance check-in and check-out verification</li>
        <li>Location is only collected when you actively check in or check out</li>
      </ul>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Call Data</h3>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li>Call logs are accessed to match completed sales calls with lead records</li>
        <li>Call recordings made through the app are stored for quality and training purposes</li>
        <li>Call transcriptions and AI-generated summaries are created from recordings</li>
      </ul>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Device Information</h3>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li>Device identifiers for push notification delivery (Expo push tokens)</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>2. How We Use Your Information</h2>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li>To provide and maintain the FieldScore platform</li>
        <li>To track employee attendance with location verification</li>
        <li>To log and manage sales calls and lead interactions</li>
        <li>To generate AI-powered call summaries for sales managers</li>
        <li>To send push notifications about new leads, call transcripts, and team updates</li>
        <li>To generate daily sales reports and performance analytics</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>3. Data Sharing</h2>
      <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
        We do not sell, trade, or share your personal information with third parties for marketing purposes. Your data may be shared with:
      </p>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li><strong>Service providers:</strong> Supabase (database hosting), Plivo (telephony), Groq and DeepSeek (AI transcription and summarization), Expo (push notifications)</li>
        <li><strong>Your organization:</strong> Admins and managers within your organization can view team data as part of normal platform functionality</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>4. Data Security</h2>
      <p style={{ lineHeight: 1.7 }}>
        All data is transmitted over encrypted HTTPS connections. Data is stored securely on Supabase with row-level security policies ensuring users can only access data within their organization and role permissions.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>5. Data Retention</h2>
      <p style={{ lineHeight: 1.7 }}>
        We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data by contacting us.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>6. Your Rights</h2>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24 }}>
        <li>Access your personal data</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your account and data</li>
        <li>Withdraw consent for location tracking by disabling location permissions</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>7. Account Deletion</h2>
      <p style={{ lineHeight: 1.7 }}>
        To request deletion of your account and all associated data, please contact us at the email address below. We will process your request within 30 days.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>8. Contact Us</h2>
      <p style={{ lineHeight: 1.7 }}>
        If you have any questions about this Privacy Policy, please contact us:
      </p>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24, marginTop: 8 }}>
        <li>Email: shamique@simsinfotech.com</li>
        <li>Company: SIMS INFOTECH</li>
      </ul>
    </main>
  )
}
