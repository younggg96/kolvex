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

// Matched by English or Chinese name. Local portraits take priority over the feed's avatar_url.
const PERSON_AVATARS: Record<string, string> = {
  "kevin warsh": "/person-updates/kevin-warsh.jpg",
  "jensen huang": "/person-updates/jensen-huang.jpg",
  "xi jinping": "/person-updates/xi-jinping.jpg",
  习近平: "/person-updates/xi-jinping.jpg",
  "vladimir putin": "/person-updates/vladimir-putin.jpg",
  普京: "/person-updates/vladimir-putin.jpg",
  "弗拉基米尔·普京": "/person-updates/vladimir-putin.jpg",
};
export const FED_SEAL_AVATAR = "/person-updates/fed-seal.jpg";

/** Local portrait, else the feed's avatar; Fed officials without a portrait get the Board seal. */
export function personAvatar({
  person,
  person_cn,
  tags,
  avatar_url,
}: Pick<PersonUpdate, "person" | "tags" | "avatar_url"> & { person_cn?: string }): string | null {
  const local =
    PERSON_AVATARS[personKey(person)] ??
    (person_cn ? PERSON_AVATARS[personKey(person_cn)] : undefined);
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

/** Filter value for the merged "all Fed officials" avatar. */
export const FED_GROUP = "fed";

/**
 * Rail entries: Fed officials who only have the shared Board seal collapse into one FED entry
 * placed where the first of them appeared. Officials with their own portrait stay separate.
 */
export function personUpdateRail(people: readonly PersonUpdatePerson[]) {
  const rail: PersonUpdatePerson[] = [];
  let fed: PersonUpdatePerson | null = null;
  for (const person of people) {
    if (!person.fedOfficial || person.avatar !== FED_SEAL_AVATAR) {
      rail.push(person);
      continue;
    }
    if (!fed) {
      fed = { ...person, name: FED_GROUP, label: "FED" };
      rail.push(fed);
    }
  }
  if (fed) {
    // The group covers every Fed official, including those shown with their own portrait.
    fed.newCount = people.reduce((sum, p) => sum + (p.fedOfficial ? p.newCount : 0), 0);
  }
  return rail;
}

export function matchesPersonFilter(item: Pick<PersonUpdate, "person" | "tags">, person: string) {
  if (!person) return true;
  if (person === FED_GROUP) return isFedOfficial(item);
  return item.person === person;
}
