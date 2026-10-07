"use client";

import { BrainCircuit, Landmark, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const icons = [Landmark, RefreshCw, ShieldAlert, BrainCircuit];

export default function LandingHowItWorks() {
  const { t } = useTranslation();
  return (
    <section id="workflow" className="border-b border-border py-14 md:py-20">
      <div className="landing-width">
        <h2 className="max-w-2xl font-editorial text-3xl font-normal md:text-4xl">{t("landing.howItWorks.title")}</h2>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{t("landing.howItWorks.subtitle")}</p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {icons.map((Icon, index) => <div key={index} className="border-t-2 border-border pt-5">
            <div className="mb-5 flex items-center justify-between"><Icon className="h-6 w-6 text-primary" /><span className="text-sm text-muted-foreground">{index + 1}</span></div>
            <h3 className="text-lg font-medium">{t(`landing.howItWorks.steps.${index}.title`)}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(`landing.howItWorks.steps.${index}.description`)}</p>
            <ul className="mt-5 space-y-2 text-xs text-muted-foreground">{[0, 1, 2].map(detail => <li key={detail} className="border-l-2 border-primary/30 pl-3">{t(`landing.howItWorks.steps.${index}.details.${detail}`)}</li>)}</ul>
          </div>)}
        </div>
      </div>
    </section>
  );
}
