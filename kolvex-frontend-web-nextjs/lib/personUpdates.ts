export interface PersonUpdate {
  id: string;
  person: string;
  person_cn: string;
  published_at: string;
  title: string;
  summary: string;
  source_url: string;
  impact: "high" | "medium" | "low";
  tags: string[];
  tickers: string[];
  avatar_url?: string | null;
  image_url: string | null;
  image_alt: string | null;
}

export const PERSON_UPDATE_ZONES = [
  ["America/Los_Angeles", "PT", "PT"],
  ["America/New_York", "ET", "ET"],
  ["Asia/Shanghai", "Beijing time", "北京时间"],
] as const;

export function personUpdateTime(timestamp: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

export interface PersonUpdatePerson {
  name: string;
  label: string;
  avatar: string | null;
  fedOfficial: boolean;
  newCount: number;
}

// Governors, FOMC alternates and Reserve Bank presidents in the October 2026 minutes:
// https://www.federalreserve.gov/monetarypolicy/fomcminutes20261028.htm
const FED_OFFICIALS = new Set([
  "kevin warsh",
  "john williams",
  "michael barr",
  "michelle bowman",
  "lisa cook",
  "beth hammack",
  "philip jefferson",
  "neel kashkari",
  "lorie logan",
  "anna paulson",
  "jerome powell",
  "christopher waller",
  "thomas barkin",
  "mary daly",
  "austan goolsbee",
  "sushmita shukla",
  "cheryl venable",
  "susan collins",
  "alberto musalem",
  "jeffrey schmid",
]);

function personKey(person: string) {
  return person
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ [a-z]\.?(?= )/g, "");
}

// Local portraits take priority over the feed's avatar_url.
const PERSON_AVATARS: Record<string, string> = {
  "kevin warsh": "/person-updates/kevin-warsh.jpg",
  "jensen huang": "/person-updates/jensen-huang.jpg",
  "xi jinping": "/person-updates/xi-jinping.jpg",
};
export const FED_SEAL_AVATAR = "/person-updates/fed-seal.jpg";

/** Local portrait, else the feed's avatar; Fed officials without a portrait get the Board seal. */
export function personAvatar({
  person,
  tags,
  avatar_url,
}: Pick<PersonUpdate, "person" | "tags" | "avatar_url">): string | null {
  const local = PERSON_AVATARS[personKey(person)];
  if (local) return local;
  if (isFedOfficial({ person, tags })) return FED_SEAL_AVATAR;
  return avatar_url || null;
}

export function isFedOfficial({ person, tags }: Pick<PersonUpdate, "person" | "tags">) {
  const name = personKey(person);
  return (
    FED_OFFICIALS.has(name) ||
    tags.some((tag) => ["美联储官员", "fed official"].includes(tag.trim().toLowerCase()))
  );
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** The timeline arrives newest first, so each person starts with their latest entry. */
export function personUpdatePeople(items: readonly PersonUpdate[], now: number) {
  const people = new Map<string, PersonUpdatePerson>();
  for (const item of items) {
    let person = people.get(item.person);
    if (!person) {
      person = {
        name: item.person,
        label: item.person_cn,
        avatar: null,
        fedOfficial: isFedOfficial(item),
        newCount: 0,
      };
      people.set(item.person, person);
    }
    person.avatar ||= personAvatar(item);
    const age = now - Date.parse(item.published_at);
    if (age >= 0 && age < ONE_DAY_MS) person.newCount += 1;
  }
  return Array.from(people.values());
}
