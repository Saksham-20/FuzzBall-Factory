import { grievancePolicy } from "@/components/content/policies/grievance";
import { ipPolicy } from "@/components/content/policies/ip";
import { pricingPolicy } from "@/components/content/policies/pricing";
import { privacyPolicy } from "@/components/content/policies/privacy";
import { refundPolicy } from "@/components/content/policies/refund";
import { shippingPolicy } from "@/components/content/policies/shipping";
import { termsPolicy } from "@/components/content/policies/terms";
import type { PolicyDoc } from "@/components/content/policies/types";

export const POLICIES: Record<PolicyDoc["slug"], PolicyDoc> = {
  shipping: shippingPolicy,
  refund: refundPolicy,
  terms: termsPolicy,
  privacy: privacyPolicy,
  grievance: grievancePolicy,
  ip: ipPolicy,
  pricing: pricingPolicy,
};

export const POLICY_SLUGS = Object.keys(POLICIES) as PolicyDoc["slug"][];

export const getPolicy = (slug: string): PolicyDoc | undefined =>
  (POLICY_SLUGS as string[]).includes(slug) ? POLICIES[slug as PolicyDoc["slug"]] : undefined;
