import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { FaqAccordion, type FaqItem } from "../components/FaqAccordion";

const FAQS: FaqItem[] = [
  {
    question: "What exactly is Raritone?",
    answer:
      "Raritone is a fashion technology experience: you try outfits on virtually, save the looks you love to a personal Style Calendar, keep a daily streak going, and unlock eligible fashion rewards from partner campaigns. It is not a conventional online shopping marketplace — shopping supports the experience rather than dominating it.",
  },
  {
    question: "Is Live Virtual Try-On available right now?",
    answer:
      "The camera-first app is usable today for photo try-on with your own garments. The real-time Live Try-On experience is in development — we switch it on only when it genuinely works, and we label it 'coming soon' until then.",
  },
  {
    question: "How does the 30-day Style Streak work?",
    answer:
      "Complete a qualifying try-on, save the outfit to your Style Calendar, and pass the server-side checks. That counts as one qualifying day. One qualifying check-in per calendar day (Indian Standard Time). Reach 30 consecutive days to complete the challenge and qualify for eligible rewards.",
  },
  {
    question: "What happens if I miss a day?",
    answer:
      "In the initial strict design, a missed day resets your consecutive streak to zero. Your historical completed days remain visible on your calendar — the record isn't erased, but the run starts again. If a verified outage on our side stopped you, an exception can be applied so an honest streak isn't broken.",
  },
  {
    question: "Are rewards guaranteed?",
    answer:
      "No. Rewards come from partner-funded campaigns with limited inventory, eligibility rules, maximum values, purchase conditions, and expiry dates. Everything is shown next to the offer before you claim. If no reward is available when you complete a streak, we'll tell you plainly and point you to support.",
  },
  {
    question: "Do I need a membership to use Raritone?",
    answer:
      "No. You can create a free account and explore publicly available features without paying. Membership plans unlock the full Style Streak challenge, enhanced tracking, and access to plan-level eligible offers.",
  },
  {
    question: "How much do the plans cost?",
    answer:
      "Proposed launch prices: Starter ₹99/month or ₹999/year, Plus ₹199/month or ₹1,999/year, and VIP ₹399/month or ₹3,999/year. Annual billing saves you ₹189, ₹389, or ₹789 a year respectively. Online checkout is not open yet — prices and benefits are configurable and may change before launch.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, any time. Access continues until the end of the paid period. Renewal frequency, cancellation rules, and refunds are described in the Subscription and Refund Policy before you pay.",
  },
  {
    question: "What happens to my photos and camera data?",
    answer:
      "Your camera is used only while you're creating a try-on, and nothing is published unless you share it. Saved try-ons are private by default, labelled as AI-generated, and deletable. We never train on private body imagery by default.",
  },
  {
    question: "I'm a fashion brand. How do I partner with Raritone?",
    answer:
      "Head to the Brand Partnerships page and submit the inquiry form. We review every application, agree campaign details in writing, and only then activate offers. You get trackable links, coupon claim counts, and verified redemption reporting.",
  },
];

export function FaqPage(): ReactNode {
  usePageMeta({
    title: "FAQ | Raritone",
    description:
      "Answers about Raritone's virtual try-on, the 30-day Style Streak, reward eligibility, membership plans, cancellation, and privacy.",
    path: "/faq",
  });

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">FAQ</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-coal sm:text-5xl">
            Fair questions, straight answers.
          </h1>
        </Reveal>
      </section>
      <section className="border-t border-coal/8 bg-white">
        <div className="st-container max-w-3xl py-16 sm:py-20">
          <Reveal>
            <FaqAccordion items={FAQS} />
          </Reveal>
          <Reveal className="mt-10 text-center">
            <p className="text-sm text-coal-500">
              Something else on your mind?{" "}
              <Link to="/contact" className="font-medium text-coal underline underline-offset-2">
                Contact the team
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
