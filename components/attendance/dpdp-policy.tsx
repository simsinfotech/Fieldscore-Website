import { ACTIVITY_RETENTION_MONTHS } from "@/lib/attendance/constants"

/**
 * DPDP Act 2023 notice text — reused by the first-login modal and the
 * permanent Settings link. Update DPDP_POLICY_VERSION when this changes.
 */
export function DpdpPolicyText() {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        To keep attendance accurate and fix the forgotten-checkout problem, this
        workspace records limited activity data while you are checked in.
      </p>
      <div>
        <p className="font-medium text-foreground">What we collect</p>
        <ul className="list-disc pl-5">
          <li>Whether you were active in each one-minute interval</li>
          <li>Session check-in / check-out times</li>
          <li>The IP address at check-in</li>
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">What we do <em>not</em> collect</p>
        <ul className="list-disc pl-5">
          <li>Keystrokes or screenshots</li>
          <li>Browsing history or the content of your work</li>
          <li>Application or window titles</li>
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Purpose</p>
        <p>Accurate attendance and management reporting only.</p>
      </div>
      <div>
        <p className="font-medium text-foreground">Retention</p>
        <p>
          Minute-level activity is kept for {ACTIVITY_RETENTION_MONTHS} months, then
          permanently deleted; only daily summaries are retained beyond that.
        </p>
      </div>
      <div>
        <p className="font-medium text-foreground">Who can see it</p>
        <p>You, your manager, and HR. You can export your own data at any time.</p>
      </div>
    </div>
  )
}
