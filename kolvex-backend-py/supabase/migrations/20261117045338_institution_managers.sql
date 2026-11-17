-- Superinvestors coverage list, edited by admins instead of a code constant.
-- The backend reads enabled rows into memory (refreshed every few minutes and
-- after each admin write) and falls back to its built-in list when this table
-- cannot be read. Only the backend service role may read/write.
create table public.institution_managers (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  cik bigint not null unique check (cik > 0),
  name text not null check (length(btrim(name)) between 1 and 120),
  zh_name text check (zh_name is null or length(btrim(zh_name)) between 1 and 80),
  person_en text check (person_en is null or length(person_en) <= 80),
  person_zh text check (person_zh is null or length(person_zh) <= 80),
  role_en text check (role_en is null or length(role_en) <= 60),
  role_zh text check (role_zh is null or length(role_zh) <= 60),
  category text not null default 'other'
    check (category in ('classic', 'chinese', 'value', 'activist', 'growth', 'other')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index institution_managers_enabled on public.institution_managers(sort_order, id) where enabled;

alter table public.institution_managers enable row level security;
revoke all on public.institution_managers from anon, authenticated;
grant all on public.institution_managers to service_role;

-- The 33 managers tracked before this table existed (enabled), then candidates
-- whose CIKs were checked against SEC EDGAR on 2026-11-16 (latest 13F-HR for
-- 2026-09-30). Candidates stay disabled until an admin reviews and enables them.
insert into public.institution_managers
  (id, cik, name, zh_name, person_en, person_zh, role_en, role_zh, category, enabled, sort_order)
values
  ('berkshire', 1067983, 'Berkshire Hathaway', '伯克希尔·哈撒韦', 'Warren Buffett', '沃伦·巴菲特', 'Chairman', '董事长', 'classic', true, 10),
  ('bridgewater', 1350694, 'Bridgewater Associates', '桥水基金', 'Ray Dalio', '瑞·达利欧', 'Founder', '创始人', 'classic', true, 20),
  ('pershing', 1336528, 'Pershing Square', '潘兴广场', 'Bill Ackman', '比尔·阿克曼', 'Founder & CEO', '创始人兼 CEO', 'classic', true, 30),
  ('duquesne', 1536411, 'Duquesne Family Office', '杜肯家族办公室', 'Stanley Druckenmiller', '斯坦利·德鲁肯米勒', 'Founder', '创始人', 'classic', true, 40),
  ('appaloosa', 1656456, 'Appaloosa', '阿帕卢萨', 'David Tepper', '大卫·泰珀', 'Founder', '创始人', 'classic', true, 50),
  ('baupost', 1061768, 'Baupost Group', '包普斯特集团', 'Seth Klarman', '塞斯·卡拉曼', 'CEO', 'CEO', 'classic', true, 60),
  ('tiger', 1167483, 'Tiger Global', '老虎环球', 'Chase Coleman', '蔡斯·科尔曼', 'Founder', '创始人', 'classic', true, 70),
  ('third_point', 1040273, 'Third Point', '第三点', 'Daniel Loeb', '丹尼尔·勒布', 'Founder & CEO', '创始人兼 CEO', 'classic', true, 80),
  ('oaktree', 949509, 'Oaktree Capital', '橡树资本', 'Howard Marks', '霍华德·马克斯', 'Co-founder', '联合创始人', 'classic', true, 90),
  ('renaissance', 1037389, 'Renaissance Technologies', '文艺复兴科技', 'Jim Simons', '吉姆·西蒙斯', 'Founder', '创始人', 'classic', true, 100),
  ('duan_yongping', 1759760, 'H&H International Investment', 'H&H 国际投资', 'Duan Yongping', '段永平', 'Founder', '创始人', 'chinese', true, 110),
  ('himalaya', 1709323, 'Himalaya Capital', '喜马拉雅资本', 'Li Lu', '李录', 'Founder', '创始人', 'chinese', true, 120),
  ('hhlr', 1762304, 'HHLR Advisors', '高瓴 HHLR', 'Zhang Lei', '张磊', 'Founder', '创始人', 'chinese', true, 130),
  ('greenwoods', 1848138, 'Greenwoods Asset Management', '景林资产', 'Jiang Jinzhi', '蒋锦志', 'Founder', '创始人', 'chinese', true, 140),
  ('temasek', 1021944, 'Temasek Holdings', '淡马锡', 'Dilhan Pillay', '狄尔汉·皮莱', 'CEO', 'CEO', 'chinese', true, 150),
  ('pabrai', 1549575, 'Dalal Street (Pabrai)', '帕伯莱投资', 'Mohnish Pabrai', '莫尼什·帕伯莱', 'Founder', '创始人', 'value', true, 160),
  ('markel', 1096343, 'Markel Group', '马克尔集团', 'Tom Gayner', '汤姆·盖纳', 'CEO', 'CEO', 'value', true, 170),
  ('fairfax', 915191, 'Fairfax Financial', '费尔法克斯金融', 'Prem Watsa', '普雷姆·瓦特萨', 'Founder & Chairman', '创始人兼董事长', 'value', true, 180),
  ('akre', 1112520, 'Akre Capital Management', '阿克雷资本', 'Chuck Akre', '查克·阿克雷', 'Founder', '创始人', 'value', true, 190),
  ('gardner_russo', 860643, 'Gardner Russo & Quinn', '加德纳·鲁索', 'Tom Russo', '汤姆·鲁索', 'Partner', '合伙人', 'value', true, 200),
  ('ruane', 1720792, 'Ruane, Cunniff & Goldfarb', '红杉基金（鲁安·坎尼夫）', 'Bill Ruane', '比尔·鲁安', 'Founder', '创始人', 'value', true, 210),
  ('fundsmith', 1569205, 'Fundsmith', '芬德史密斯', 'Terry Smith', '特里·史密斯', 'Founder & CEO', '创始人兼 CEO', 'value', true, 220),
  ('icahn', 921669, 'Carl Icahn', '伊坎', 'Carl Icahn', '卡尔·伊坎', 'Founder', '创始人', 'activist', true, 230),
  ('elliott', 1791786, 'Elliott Investment Management', '艾略特管理', 'Paul Singer', '保罗·辛格', 'Founder', '创始人', 'activist', true, 240),
  ('trian', 1345471, 'Trian Fund Management', '特里安基金', 'Nelson Peltz', '尼尔森·佩尔茨', 'Founder & CEO', '创始人兼 CEO', 'activist', true, 250),
  ('valueact', 1418814, 'ValueAct Capital', 'ValueAct 资本', 'Mason Morfit', '梅森·莫菲特', 'CEO', 'CEO', 'activist', true, 260),
  ('starboard', 1517137, 'Starboard Value', 'Starboard 价值', 'Jeff Smith', '杰夫·史密斯', 'Founder & CEO', '创始人兼 CEO', 'activist', true, 270),
  ('ark', 1697748, 'ARK Invest', '方舟投资', 'Cathie Wood', '凯茜·伍德', 'Founder & CEO', '创始人兼 CEO', 'growth', true, 280),
  ('coatue', 1135730, 'Coatue Management', 'Coatue 资本', 'Philippe Laffont', '菲利普·拉丰', 'Founder', '创始人', 'growth', true, 290),
  ('lone_pine', 1061165, 'Lone Pine Capital', '孤松资本', 'Stephen Mandel', '斯蒂芬·曼德尔', 'Founder', '创始人', 'growth', true, 300),
  ('altimeter', 1541617, 'Altimeter Capital', 'Altimeter 资本', 'Brad Gerstner', '布拉德·格斯特纳', 'Founder & CEO', '创始人兼 CEO', 'growth', true, 310),
  ('soros', 1029160, 'Soros Fund Management', '索罗斯基金管理', 'George Soros', '乔治·索罗斯', 'Founder', '创始人', 'other', true, 320),
  ('gates', 1166559, 'Gates Foundation Trust', '盖茨基金会信托', 'Bill Gates', '比尔·盖茨', 'Co-founder', '联合创始人', 'other', true, 330),
  ('viking', 1103804, 'Viking Global Investors', '维京全球', 'Andreas Halvorsen', '安德烈亚斯·哈尔沃森', 'Founder', '创始人', 'growth', false, 1000),
  ('d1', 1747057, 'D1 Capital Partners', 'D1 资本', 'Dan Sundheim', '丹·桑德海姆', 'Founder', '创始人', 'growth', false, 1010),
  ('durable', 1798849, 'Durable Capital Partners', 'Durable 资本', 'Henry Ellenbogen', '亨利·埃伦博根', 'Founder', '创始人', 'growth', false, 1020),
  ('baillie_gifford', 1088875, 'Baillie Gifford', '柏基投资', null, null, null, null, 'growth', false, 1030),
  ('polen', 1034524, 'Polen Capital', '波伦资本', null, null, null, null, 'growth', false, 1040),
  ('gotham', 1510387, 'Gotham Asset Management', '哥谭资产', 'Joel Greenblatt', '乔尔·格林布拉特', 'Co-founder', '联合创始人', 'value', false, 1050),
  ('southeastern', 807985, 'Southeastern Asset Management', '东南资产管理', 'Mason Hawkins', '梅森·霍金斯', 'Founder', '创始人', 'value', false, 1060),
  ('oakmark', 813917, 'Harris Associates (Oakmark)', '哈里斯联合（Oakmark）', 'Bill Nygren', '比尔·奈格伦', 'Portfolio Manager', '基金经理', 'value', false, 1070),
  ('tweedy_browne', 732905, 'Tweedy, Browne', '特威迪·布朗', null, null, null, null, 'value', false, 1080),
  ('pzena', 1027796, 'Pzena Investment Management', '皮泽纳投资', 'Richard Pzena', '理查德·皮泽纳', 'Founder', '创始人', 'value', false, 1090),
  ('abrams', 1358706, 'Abrams Capital', '艾布拉姆斯资本', 'David Abrams', '大卫·艾布拉姆斯', 'Founder', '创始人', 'value', false, 1100),
  ('fairholme', 1056831, 'Fairholme Capital', '费尔霍姆资本', 'Bruce Berkowitz', '布鲁斯·伯科维茨', 'Founder', '创始人', 'value', false, 1110),
  ('semper_augustus', 1115373, 'Semper Augustus', 'Semper Augustus', 'Chris Bloomstran', '克里斯·布卢姆斯特兰', 'Founder', '创始人', 'value', false, 1120),
  ('giverny', 1641864, 'Giverny Capital', '吉维尼资本', 'François Rochon', '弗朗索瓦·罗雄', 'Founder', '创始人', 'value', false, 1130),
  ('chou', 1389403, 'Chou Associates', '周氏联合', 'Francis Chou', '弗朗西斯·周', 'Founder', '创始人', 'value', false, 1140),
  ('brave_warrior', 1553733, 'Brave Warrior Advisors', 'Brave Warrior', 'Glenn Greenberg', '格伦·格林伯格', 'Founder', '创始人', 'value', false, 1150),
  ('first_eagle', 1325447, 'First Eagle Investment Management', '第一鹰投资', null, null, null, null, 'value', false, 1160),
  ('tci', 1647251, 'TCI Fund Management', 'TCI 基金', 'Chris Hohn', '克里斯·霍恩', 'Founder', '创始人', 'activist', false, 1170),
  ('glenview', 1138995, 'Glenview Capital', '格伦维尤资本', 'Larry Robbins', '拉里·罗宾斯', 'Founder', '创始人', 'other', false, 1180),
  ('maverick', 934639, 'Maverick Capital', '小牛资本', 'Lee Ainslie', '李·安斯利', 'Founder', '创始人', 'other', false, 1190),
  ('tudor', 923093, 'Tudor Investment', '都铎投资', 'Paul Tudor Jones', '保罗·都铎·琼斯', 'Founder', '创始人', 'other', false, 1200),
  ('point72', 1603466, 'Point72 Asset Management', 'Point72', 'Steve Cohen', '史蒂夫·科恩', 'Founder', '创始人', 'other', false, 1210),
  ('fisher', 850529, 'Fisher Asset Management', '费雪投资', 'Ken Fisher', '肯·费雪', 'Founder', '创始人', 'other', false, 1220),
  ('norges', 1374170, 'Norges Bank', '挪威央行（主权基金）', null, null, null, null, 'other', false, 1230)
on conflict (id) do nothing;
