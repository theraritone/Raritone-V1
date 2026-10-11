import type { ReactNode } from "react";
import { LegalPage } from "../components/LegalPage";

export function PrivacyPolicyPage(): ReactNode {
  return (
    <LegalPage
      path="/privacy-policy"
      title="Privacy Policy"
      metaTitle="Privacy Policy | Raritone"
      description="How Raritone collects, uses, stores, and protects your data — camera and try-on imagery, account details, and your choices and rights."
      updated="October 2026"
      intro="This policy explains what Raritone Private Limited collects when you use raritone.com and the Raritone app, why we collect it, and the controls you have. We wrote it to be read, not skimmed past."
      sections={[
        {
          heading: "What we collect",
          bullets: [
            "Account details: your name, email address, and a securely hashed password. We never store plain-text passwords.",
            "Try-on content: photos and garments you upload, and try-on results you choose to save. These are private to your account by default.",
            "Camera data: camera frames are processed only while you create a try-on. We do not continuously store your camera stream.",
            "Streak and membership activity: qualifying check-ins, saved looks, plan, and payment status, so your calendar and rewards work.",
            "Messages you send us: contact and partner-application forms.",
            "Basic technical logs needed to run the service securely (such as rate-limiting counters). We do not log image bytes or provider credentials.",
          ],
        },
        {
          heading: "What we do not do",
          bullets: [
            "We do not sell your personal data.",
            "We do not train AI models on your private body imagery by default.",
            "We do not publish anything you create unless you choose to share it.",
            "We do not send marketing notifications unless you opt in, and you can opt out again at any time.",
          ],
        },
        {
          heading: "How try-on works, honestly",
          paragraphs: [
            "Try-on results are AI-generated visuals, labelled as such wherever they appear. They are an illustrative preview, not a photo of you and not a guarantee of size or fit.",
          ],
        },
        {
          heading: "Sharing with partners",
          paragraphs: [
            "Rewards come from partner campaigns. When you claim or redeem a reward, we share the minimum details needed to validate it (such as a single-use coupon code and redemption status) with the partner funding that campaign. We never share your private wardrobe or body imagery with brands.",
          ],
        },
        {
          heading: "Your choices and rights",
          bullets: [
            "Access and export: request a copy of your data from Account Settings or by contacting us.",
            "Deletion: request account deletion from Account Settings or by contacting us. We remove your content and confirm when the deletion is complete, within disclosed timelines.",
            "Communication preferences: control streak reminders and marketing messages in your notification preferences.",
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "Passwords are stored only as salted hashes through a verified authentication scheme. Payment details are handled by our regulated payment provider — we never see or store your card number. Access to administrative systems is role-restricted and audited.",
          ],
        },
        {
          heading: "Children",
          paragraphs: [
            "Raritone is not directed at children under 13, and we do not knowingly collect their personal data.",
          ],
        },
        {
          heading: "Changes and contact",
          paragraphs: [
            "We will announce material changes on this page before they take effect. Questions or requests: use the contact form and pick “Privacy or data request”.",
          ],
        },
      ]}
    />
  );
}
