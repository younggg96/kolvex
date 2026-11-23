const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const context = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, "../lib/personUpdates.ts"), "utf8");
vm.runInNewContext(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  context,
);
const {
  PERSON_UPDATE_ZONES,
  personUpdateTime,
  personUpdatePeople,
  isFedOfficial,
  personAvatar,
  FED_SEAL_AVATAR,
  FED_GROUP,
  personUpdateRail,
  matchesPersonFilter,
} = context.exports;

test("the same instant keeps each market's local date", () => {
  const winter = "2026-11-18T02:44:00-05:00";
  const result = PERSON_UPDATE_ZONES.map(([zone]) => personUpdateTime(winter, "en-US", zone));
  assert.equal(result[0], "Nov 17, 2026, 23:44");
  assert.equal(result[1], "Nov 18, 2026, 02:44");
  assert.equal(result[2], "Nov 18, 2026, 15:44");
});

test("market time follows daylight saving time", () => {
  const summer = "2026-07-20T12:00:00Z";
  assert.match(personUpdateTime(summer, "zh-CN", "America/Los_Angeles"), /05:00/);
  assert.match(personUpdateTime(summer, "zh-CN", "America/New_York"), /08:00/);
  assert.match(personUpdateTime(summer, "zh-CN", "Asia/Shanghai"), /20:00/);
});

test("groups the avatar rail by person and counts only updates from the last 24 hours", () => {
  const now = Date.parse("2026-11-18T10:00:00Z");
  const items = [
    { person: "Alpha", person_cn: "甲", published_at: "2026-11-18T11:00:00Z" },
    { person: "Alpha", person_cn: "甲", published_at: "2026-11-18T10:00:00Z" },
    { person: "Beta", person_cn: "乙", published_at: "2026-11-18T04:00:00-05:00" },
    {
      person: "Alpha",
      person_cn: "甲",
      published_at: "2026-11-17T10:00:01Z",
      avatar_url: "https://example.test/alpha.jpg",
    },
    {
      person: "Beta",
      person_cn: "乙",
      published_at: "2026-11-17T10:00:00Z",
      avatar_url: "https://example.test/beta.jpg",
    },
    { person: "Gamma", person_cn: "丙", published_at: "invalid" },
  ];
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        personUpdatePeople(
          items.map((item) => ({ ...item, tags: [] })),
          now,
        ),
      ),
    ),
    [
      {
        name: "Alpha",
        label: "甲",
        avatar: "https://example.test/alpha.jpg",
        fedOfficial: false,
        newCount: 2,
      },
      {
        name: "Beta",
        label: "乙",
        avatar: "https://example.test/beta.jpg",
        fedOfficial: false,
        newCount: 1,
      },
      { name: "Gamma", label: "丙", avatar: null, fedOfficial: false, newCount: 0 },
    ],
  );
});

test("only recognized officials and explicit role labels opt into the Fed avatar", () => {
  assert.equal(isFedOfficial({ person: " Jerome H. Powell ", tags: [] }), true);
  assert.equal(isFedOfficial({ person: "Kevin Warsh", tags: [] }), true);
  assert.equal(isFedOfficial({ person: "Someone Unlisted", tags: ["美联储官员"] }), true);
  assert.equal(isFedOfficial({ person: "Someone Unlisted", tags: ["  Fed Official "] }), true);
  assert.equal(isFedOfficial({ person: "Donald Trump", tags: ["美联储", "FOMC"] }), false);
  assert.equal(isFedOfficial({ person: "Mary Daly Jr.", tags: [] }), false);
  const items = [
    {
      person: "Christopher J. Waller",
      person_cn: "沃勒",
      tags: [],
      avatar_url: "https://example.test/headshot.jpg",
      published_at: "2026-11-18T10:00:00Z",
    },
  ];
  assert.equal(personUpdatePeople(items, Date.parse(items[0].published_at))[0].fedOfficial, true);
});

test("local portraits win, other Fed officials get the Board seal", () => {
  const feed = "https://example.test/feed.jpg";
  assert.equal(
    personAvatar({ person: "Kevin M. Warsh", tags: [], avatar_url: feed }),
    "/person-updates/kevin-warsh.jpg",
  );
  assert.equal(
    personAvatar({ person: "Jensen Huang", tags: [], avatar_url: feed }),
    "/person-updates/jensen-huang.jpg",
  );
  assert.equal(personAvatar({ person: "Xi Jinping", tags: [] }), "/person-updates/xi-jinping.jpg");
  assert.equal(
    personAvatar({
      person: "Vladimir Putin",
      tags: [],
      avatar_url: "https://example.test/feed.jpg",
    }),
    "/person-updates/vladimir-putin.jpg",
  );
  assert.equal(
    personAvatar({ person: "习近平", person_cn: "习近平", tags: [] }),
    "/person-updates/xi-jinping.jpg",
  );
  assert.equal(
    personAvatar({ person: "John Williams", tags: [], avatar_url: feed }),
    FED_SEAL_AVATAR,
  );
  assert.equal(personAvatar({ person: "Someone", tags: ["美联储官员"] }), FED_SEAL_AVATAR);
  assert.equal(personAvatar({ person: "Elon Musk", tags: [], avatar_url: feed }), feed);
  assert.equal(personAvatar({ person: "Elon Musk", tags: [] }), null);
});

test("Fed officials sharing the seal collapse into one rail entry that filters all Fed officials", () => {
  const people = [
    { name: "Scott Bessent", label: "贝森特", avatar: "/b.jpg", fedOfficial: false, newCount: 1 },
    {
      name: "Michael Barr",
      label: "巴尔",
      avatar: FED_SEAL_AVATAR,
      fedOfficial: true,
      newCount: 2,
    },
    { name: "Kevin Warsh", label: "沃什", avatar: "/w.jpg", fedOfficial: true, newCount: 1 },
    { name: "Lisa Cook", label: "库克", avatar: FED_SEAL_AVATAR, fedOfficial: true, newCount: 0 },
  ];
  const rail = personUpdateRail(people);
  assert.deepEqual(JSON.parse(JSON.stringify(rail.map((p) => [p.name, p.newCount]))), [
    ["Scott Bessent", 1],
    [FED_GROUP, 3],
    ["Kevin Warsh", 1],
  ]);
  assert.equal(matchesPersonFilter({ person: "Kevin Warsh", tags: [] }, FED_GROUP), true);
  assert.equal(matchesPersonFilter({ person: "Anyone", tags: ["美联储官员"] }, FED_GROUP), true);
  assert.equal(matchesPersonFilter({ person: "Scott Bessent", tags: [] }, FED_GROUP), false);
  assert.equal(matchesPersonFilter({ person: "Scott Bessent", tags: [] }, ""), true);
});

test("an admin-set portrait wins over bundled portraits, the Fed seal and the update's avatar", () => {
  const profile = "https://upload.wikimedia.org/portrait.jpg";
  for (const person of ["Jensen Huang", "Jerome Powell", "Donald Trump"]) {
    assert.equal(
      personAvatar({
        person,
        tags: [],
        avatar_url: "https://example.test/feed.jpg",
        profile_avatar_url: profile,
      }),
      profile,
    );
  }
  assert.equal(
    personAvatar({ person: "Jensen Huang", tags: [], profile_avatar_url: null }),
    "/person-updates/jensen-huang.jpg",
  );
});
