export const metadata = {
  title: "Delete Account — FieldScore",
}

export default function DeleteAccountPage() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#e0e0e0", backgroundColor: "#060B18", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Delete Your Account</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>Request deletion of your FieldScore account and all associated data.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>How to Request Account Deletion</h2>
      <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
        To delete your FieldScore account and all data associated with it, please send an email to:
      </p>
      <p style={{ fontSize: 18, fontWeight: 600, color: "#00E5FF", marginBottom: 24 }}>
        shamique@simsinfotech.com
      </p>
      <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
        Include the following in your email:
      </p>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24, marginBottom: 24 }}>
        <li>Subject line: &quot;Account Deletion Request&quot;</li>
        <li>Your registered email address</li>
        <li>Your registered phone number</li>
        <li>Your organization name</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>What Gets Deleted</h2>
      <ul style={{ lineHeight: 1.8, paddingLeft: 24, marginBottom: 24 }}>
        <li>Your user account and profile information</li>
        <li>Attendance records</li>
        <li>Call logs and recordings associated with your account</li>
        <li>Call transcriptions and AI summaries</li>
        <li>Lead activity entries created by you</li>
        <li>Push notification tokens</li>
        <li>EOD reports submitted by you</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Processing Time</h2>
      <p style={{ lineHeight: 1.7 }}>
        We will process your deletion request within 30 days of receiving it. You will receive a confirmation email once your account and data have been deleted.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
      <p style={{ lineHeight: 1.7 }}>
        If you have any questions, contact us at shamique@simsinfotech.com
      </p>
    </main>
  )
}
