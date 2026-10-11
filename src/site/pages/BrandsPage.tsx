import { useState, type FormEvent, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { ConsentCheckbox, Field, FormStatus, apiErrorMessage } from "../components/forms";
import { ArrowRight, Check, TrendIcon } from "../components/icons";
import { submitPartnerApplication } from "../api";
import { PARTNERSHIP_TYPES } from "../../../shared/site.js";

const INITIAL = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  category: "",
  city: "",
  catalogueSize: "",
  proposedOffer: "",
  notes: "",
};

/**
 * The brand partnerships page. Features that exist today are separated from
 * planned capabilities, no partner is invented, and the inquiry form saves to
 * the backend before any confirmation is shown.
 */
export function BrandsPage(): ReactNode {
  usePageMeta({
    title: "Fashion Brand Partnerships | Raritone",
    description:
      "Turn virtual try-on into real fashion discovery — partner with Raritone on coupon campaigns, try-on placement, and trackable, measurable campaigns.",
    path: "/brands",
  });

  const [form, setForm] = useState(INITIAL);
  const [types, setTypes] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof INITIAL) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const toggleType = (type: string): void =>
    setTypes((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.businessName.trim().length < 2) next.businessName = "Enter your business or brand name.";
    if (form.contactName.trim().length < 2) next.contactName = "Enter a contact person's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid business email.";
    if (form.phone.replace(/\D/g, "").length < 10) next.phone = "Enter a valid phone number.";
    if (!form.website.trim()) next.website = "Add your website or Instagram URL.";
    if (!form.category.trim()) next.category = "Tell us your brand category.";
    if (!form.city.trim()) next.city = "Enter your city.";
    if (types.length === 0) next.types = "Choose at least one partnership type.";
    if (!consent) next.consent = "Please accept the privacy notice to continue.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await submitPartnerApplication({
        businessName: form.businessName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        category: form.category.trim(),
        city: form.city.trim(),
        catalogueSize: form.catalogueSize.trim(),
        partnershipTypes: types,
        proposedOffer: form.proposedOffer.trim(),
        notes: form.notes.trim(),
        consent: true,
      });
      setStatus("success");
      setMessage(
        "Application received and saved. Our partnerships team reviews every application and will reach out on the details you shared.",
      );
      setForm(INITIAL);
      setTypes([]);
      setConsent(false);
    } catch (error) {
      setStatus("error");
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">For fashion brands</p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-coal sm:text-5xl">
            Turn Virtual Try-On Into <span className="italic text-gold-deep">Real Fashion Discovery.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Raritone helps fashion brands reach style-conscious customers through virtual try-on experiences, exclusive
            offers, and trackable campaigns.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#apply" className="st-btn-primary px-6 py-3 text-[15px]">
              Become a Raritone Partner
            </a>
            <Link to="/contact" className="st-btn-outline px-6 py-3 text-[15px]">
              Discuss a Campaign
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Benefits */}
      <section className="border-t border-coal/8 bg-white">
        <div className="st-container py-16 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">What a partnership includes</h2>
            <p className="mt-3 text-sm text-coal-500">Live today and on the launch roadmap — labelled honestly.</p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Product discovery", body: "Your products surface inside eligible try-on experiences.", when: "Live today" },
              { title: "Brand showcases", body: "Brand and collection showcases inside the app.", when: "Live today" },
              { title: "Coupon distribution", body: "Coupon and voucher distribution through verified rewards.", when: "Live today" },
              { title: "Trackable links", body: "Trackable campaign links with per-campaign reporting.", when: "Live today" },
              { title: "Sponsored streaks", body: "Sponsored Style Streak campaigns with your offer at day 30.", when: "Planned" },
              { title: "In-store try-on", body: "In-store digital try-on screens, where supported.", when: "Planned" },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 70}>
                <article className="st-card h-full p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-coal">
                      <TrendIcon width={18} height={18} />
                    </span>
                    <span className={`st-chip ${item.when === "Planned" ? "" : "border-gold/40 bg-gold-soft text-gold-deep"}`}>
                      {item.when}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-coal">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-coal-500">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-coal-400">
            User engagement and redemption reports accompany every campaign. There are no fabricated case studies on
            this page — our partner showcase opens with our first confirmed collaborations.
          </p>
        </div>
      </section>

      {/* How partnership works */}
      <section className="border-t border-coal/8">
        <div className="st-container py-16 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">How partnership works</h2>
          </Reveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { title: "Apply", body: "A brand submits its business details." },
              { title: "Review", body: "Raritone reviews the brand and proposed offer." },
              { title: "Agree", body: "Both parties confirm discount funding, products, restrictions, and duration in writing." },
              { title: "Launch", body: "Raritone activates the approved offer." },
              { title: "Measure", body: "Both parties review valid clicks, coupon claims, and verified redemptions." },
            ].map((step, index) => (
              <Reveal key={step.title} delay={index * 80}>
                <li className="st-card h-full p-6">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-coal text-sm font-bold text-gold">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold text-coal">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-coal-500">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Inquiry form */}
      <section id="apply" className="scroll-mt-20 border-t border-coal/8 bg-cream/60">
        <div className="st-container py-16 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="st-eyebrow">Become a partner</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">
              Tell us about your brand.
            </h2>
            <p className="mt-3 text-sm text-coal-500">
              Applications are reviewed by the Raritone team. You'll hear from us on the contact details you share.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <form onSubmit={submit} noValidate className="st-card mx-auto mt-10 max-w-3xl space-y-5 p-6 sm:p-9">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Business / brand name" required error={errors.businessName}>
                  <input className="st-input" value={form.businessName} onChange={set("businessName")} autoComplete="organization" aria-invalid={Boolean(errors.businessName)} />
                </Field>
                <Field label="Contact person's name" required error={errors.contactName}>
                  <input className="st-input" value={form.contactName} onChange={set("contactName")} autoComplete="name" aria-invalid={Boolean(errors.contactName)} />
                </Field>
                <Field label="Business email" required error={errors.email}>
                  <input type="email" className="st-input" value={form.email} onChange={set("email")} autoComplete="email" aria-invalid={Boolean(errors.email)} />
                </Field>
                <Field label="Phone number" required error={errors.phone}>
                  <input type="tel" className="st-input" value={form.phone} onChange={set("phone")} autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
                </Field>
                <Field label="Website or Instagram URL" required error={errors.website}>
                  <input className="st-input" value={form.website} onChange={set("website")} placeholder="https://…" aria-invalid={Boolean(errors.website)} />
                </Field>
                <Field label="Brand category" required error={errors.category}>
                  <input className="st-input" value={form.category} onChange={set("category")} placeholder="e.g. Womenswear, streetwear, ethnic" aria-invalid={Boolean(errors.category)} />
                </Field>
                <Field label="City" required error={errors.city}>
                  <input className="st-input" value={form.city} onChange={set("city")} autoComplete="address-level2" aria-invalid={Boolean(errors.city)} />
                </Field>
                <Field label="Number of products or collections" hint="Optional">
                  <input className="st-input" value={form.catalogueSize} onChange={set("catalogueSize")} placeholder="e.g. ~120 SKUs" />
                </Field>
              </div>

              <fieldset>
                <legend className="st-label">Proposed partnership type *</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PARTNERSHIP_TYPES.map((type) => (
                    <label
                      key={type}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                        types.includes(type) ? "border-coal bg-paper font-medium text-coal" : "border-coal/15 text-coal-700 hover:border-coal/35"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={types.includes(type)}
                        onChange={() => toggleType(type)}
                        className="accent-[#181611]"
                        style={{ width: 16, height: 16 }}
                      />
                      {type}
                    </label>
                  ))}
                </div>
                {errors.types && (
                  <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
                    {errors.types}
                  </p>
                )}
              </fieldset>

              <Field label="Proposed discount or campaign" hint="Optional — a rough idea is fine.">
                <textarea className="st-input min-h-24" value={form.proposedOffer} onChange={set("proposedOffer")} />
              </Field>
              <Field label="Additional information" hint="Optional">
                <textarea className="st-input min-h-24" value={form.notes} onChange={set("notes")} />
              </Field>

              <ConsentCheckbox checked={consent} onChange={setConsent} error={errors.consent}>
                I consent to Raritone processing these business details under the{" "}
                <Link to="/privacy-policy" className="font-medium text-coal underline underline-offset-2">
                  Privacy Policy
                </Link>{" "}
                to review this partnership application and respond to it.
              </ConsentCheckbox>

              <FormStatus status={status} message={message} />

              <button type="submit" className="st-btn-primary w-full py-3 text-[15px]" disabled={busy}>
                {busy ? "Submitting…" : "Submit application"} {!busy && <ArrowRight width={16} height={16} />}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-coal-400">
                <Check width={13} height={13} /> A confirmation is shown only after your application is saved.
              </p>
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
