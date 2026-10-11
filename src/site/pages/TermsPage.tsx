import type { ReactNode } from "react";
import { LegalPage } from "../components/LegalPage";

export function TermsPage(): ReactNode {
  return (
    <LegalPage
      path="/terms-and-conditions"
      title="Terms and Conditions"
      metaTitle="Terms and Conditions | Raritone"
      description="The terms that govern your use of Raritone — accounts, acceptable use, try-on outputs, streaks and rewards, memberships, and liability."
      updated="October 2026"
      intro="These terms govern your use of raritone.com and the Raritone app operated by Raritone Private Limited. By creating an account or using the experience, you agree to them."
      sections={[
        {
          heading: "Your account",
          bullets: [
            "You must provide accurate registration details and keep your credentials secure.",
            "You are responsible for activity on your account.",
            "You may request deletion of your account at any time; we explain what is removed and when.",
          ],
        },
        {
          heading: "Acceptable use",
          bullets: [
            "Only upload images of yourself or content you have the right to use.",
            "Do not attempt to fake check-ins, duplicate coupons, abuse reward flows, or interfere with the service's integrity systems.",
            "Do not use the service to harass anyone or to infringe intellectual property rights.",
            "We may suspend accounts that abuse the service, with an audit record of the decision.",
          ],
        },
        {
          heading: "Try-on outputs",
          paragraphs: [
            "Virtual try-on results are AI-generated visuals provided for styling inspiration. They are not a guarantee of size, fit, colour, or appearance in reality, and they are not a photo of you. Required AI disclosures must remain on saved or shared artifacts.",
          ],
        },
        {
          heading: "Style Streak and rewards",
          bullets: [
            "A qualifying day requires a qualifying try-on saved to your Style Calendar and passing server-side verification. Opening the app does not qualify.",
            "One qualifying check-in applies per calendar day (Indian Standard Time). A missed day resets the consecutive streak under the initial strict design.",
            "Rewards are subject to each campaign's eligibility rules, inventory, maximum value, purchase conditions, and expiry. Rewards have no cash value unless a campaign explicitly states otherwise.",
            "We may void rewards obtained through manipulation, and we will tell you when no eligible reward is available rather than issuing a placeholder.",
          ],
        },
        {
          heading: "Memberships and payments",
          bullets: [
            "Paid plans renew automatically at the disclosed frequency until cancelled.",
            "Prices are in Indian rupees; applicable taxes are shown before payment.",
            "Renewal, cancellation, and refund rules are described in the Subscription and Refund Policy.",
            "Payment status is confirmed server-side through our payment provider; a frontend success screen alone never entitles you to a benefit.",
          ],
        },
        {
          heading: "Intellectual property",
          paragraphs: [
            "The Raritone name, logo, interface, and code are owned by Raritone Private Limited or its licensors. You keep ownership of the photos you upload; you grant us the limited licence needed to process them into try-on results for you.",
          ],
        },
        {
          heading: "Availability and changes",
          paragraphs: [
            "Features in development are labelled as such. We may modify or discontinue parts of the service; where that affects paid benefits, we will handle it under the Subscription and Refund Policy.",
          ],
        },
        {
          heading: "Limitation of liability",
          paragraphs: [
            "To the extent permitted by law, Raritone is not liable for indirect or consequential losses arising from use of the service. Nothing in these terms limits liability that cannot be limited under applicable Indian law.",
          ],
        },
        {
          heading: "Governing law",
          paragraphs: [
            "These terms are governed by the laws of India. Courts in India have exclusive jurisdiction, subject to mandatory consumer-protection protections that may apply where you live.",
          ],
        },
      ]}
    />
  );
}
