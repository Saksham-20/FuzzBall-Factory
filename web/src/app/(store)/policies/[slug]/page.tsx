import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadLayout } from "@/components/content/ReadLayout";
import { POLICY_SLUGS, getPolicy } from "@/components/content/policies";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getPolicy(slug);
  if (!doc) return { title: "Page not found" };
  return {
    title: doc.shortTitle,
    description: doc.description,
    alternates: { canonical: `/policies/${doc.slug}` },
  };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const doc = getPolicy(slug);
  if (!doc) notFound();
  return <ReadLayout title={doc.title} intro={doc.intro} summary={doc.summary} sections={doc.sections} updated draft />;
}
