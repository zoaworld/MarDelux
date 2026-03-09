import { SiteConfig } from "@/lib/firebase/app-settings";

const BASE = "https://mardelux.pt";

export default function JsonLd({ config }: { config: SiteConfig }) {
  const name = config.nomeEmpresa?.trim() || "MarDelux";
  const phone = config.telefone?.replace(/\D/g, "").trim();
  const tel = phone ? `+351${phone.replace(/^351/, "")}` : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${BASE}/#business`,
    name,
    url: BASE,
    description:
      "Estúdio de massagens exclusivo para mulheres. Massagens relaxantes e terapêuticas. Reserve online.",
    image: `${BASE}/images/ambiente-sereno.png`,
    logo: `${BASE}/logo/logo-lotus.svg`,
    ...(tel && { telephone: tel }),
    ...(config.email && { email: config.email }),
    address: {
      "@type": "PostalAddress",
      addressCountry: "PT",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "18:00",
    },
    priceRange: "€€",
    areaServed: {
      "@type": "Country",
      name: "Portugal",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Serviços de massagem",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Massagem relaxante" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Massagem terapêutica" },
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
