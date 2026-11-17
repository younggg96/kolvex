-- Verified SEC 13F filers. Keep any existing admin entry and its settings.
insert into public.institution_managers
  (id, cik, name, zh_name, person_en, person_zh, role_en, role_zh, category, sort_order)
values
  ('softbank', 1065521, 'SoftBank Group Corp.', '软银集团', 'Masayoshi Son', '孙正义', 'Founder', '创始人', 'growth', 340),
  ('situational_awareness', 2045724, 'Situational Awareness LP', 'Situational Awareness', 'Leopold Aschenbrenner', 'Leopold Aschenbrenner', null, null, 'growth', 350)
on conflict do nothing;
