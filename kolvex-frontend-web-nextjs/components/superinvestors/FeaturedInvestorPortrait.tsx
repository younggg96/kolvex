"use client";

import { useCopy } from "@/components/decision/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Monogram } from "./shared";

type Credit = {
  source: string;
  author: string;
  license?: { name: string; href: string };
};
// Portraits without a credit were supplied in-house and are left out of the credits list.
type Portrait = { name: string; path: string } & (Credit | { source?: undefined });

const commons = "https://commons.wikimedia.org/wiki/File:";
const ccBy = (version: string) => ({
  name: `CC BY ${version}`,
  href: `https://creativecommons.org/licenses/by/${version}/`,
});

const portraits: Record<string, Portrait> = {
  "1067983": {
    name: "Warren Buffett",
    path: "portraits/warren-buffett.jpg",
    source: `${commons}Warren_Buffett_in_2010_(cropped).jpg`,
    author: "The White House",
  },
  "1350694": {
    name: "Ray Dalio",
    path: "portraits/ray-dalio.jpg",
    source: `${commons}Web_Summit_2018_-_Forum_-_Day_2,_November_7_HM1_7481_(44858045925).jpg`,
    author: "Harry Murphy / Web Summit via Sportsfile",
    license: ccBy("2.0"),
  },
  "1336528": {
    name: "Bill Ackman",
    path: "portraits/bill-ackman.jpg",
    source: `${commons}Bill_Ackman_(26410186110)_(cropped).jpg`,
    author: "Senate Democrats",
    license: ccBy("2.0"),
  },
  "1697748": {
    name: "Cathie Wood",
    path: "portraits/cathie-wood.jpg",
    source: `${commons}Cathie_Wood_ARK_Invest_Photo.jpg`,
    author: "Caroline Wood",
    license: { name: "CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" },
  },
  "1065521": {
    name: "Masayoshi Son",
    path: "portraits/masayoshi-son.jpg",
    source: `${commons}Masayoshi_Son_(P066533-522034,_cropped).jpg`,
    author: "European Communities, 2025 / EC – Audiovisual Service",
    license: ccBy("4.0"),
  },
  "2045724": {
    name: "Leopold Aschenbrenner",
    path: "portraits/leopold-aschenbrenner.jpg",
  },
  "1759760": {
    name: "Duan Yongping",
    path: "portraits/duan-yongping.jpg",
  },
  "1029160": {
    name: "George Soros",
    path: "portraits/george-soros.jpg",
    source: `${commons}George_Soros_47th_Munich_Security_Conference_2011_crop.jpg`,
    author: "Harald Dettenborn / Munich Security Conference",
    license: { name: "CC BY 3.0 DE", href: "https://creativecommons.org/licenses/by/3.0/de/" },
  },
  pelosi: {
    name: "Nancy Pelosi",
    path: "pelosi.png",
    source: `${commons}Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg`,
    author: "John Harrington / Office of the Speaker",
  },
};

export function FeaturedInvestorPortrait({ id, name }: { id: string; name: string }) {
  const portrait = portraits[id];
  if (!portrait) return <Monogram name={name} />;
  return (
    <Avatar aria-hidden="true">
      <AvatarImage
        src={`/superinvestors/${portrait.path}`}
        alt=""
        className="object-cover object-[50%_38%]"
      />
      <AvatarFallback>
        <Monogram name={name} />
      </AvatarFallback>
    </Avatar>
  );
}

export function FeaturedInvestorPortraitCredits() {
  const c = useCopy();
  return (
    <details className="w-fit max-w-full text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded-sm py-2 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        {c("Portrait credits", "肖像来源")}
      </summary>
      <p className="mt-1">
        {c(
          "Photos are cropped and resized under the licenses below.",
          "肖像照片按下列许可裁切及缩放。",
        )}
      </p>
      <ul className="mt-2 space-y-1.5">
        {Object.values(portraits)
          .filter((portrait): portrait is Portrait & Credit => Boolean(portrait.source))
          .map(({ name, author, source, license }) => (
            <li key={source}>
              <a
                href={source}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                {name}
              </a>
              {" · "}
              {author}
              {" · "}
              {license ? (
                <a
                  href={license.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  {license.name}
                </a>
              ) : (
                c("Public domain", "公有领域")
              )}
            </li>
          ))}
      </ul>
    </details>
  );
}
