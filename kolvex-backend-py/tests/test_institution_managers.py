"""Admin-edited Superinvestors coverage list: registry snapshots, fallback and the admin routes."""

import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import verify_admin
from app.api.routes.admin import institutions
from app.services.sec.managers import BUILTIN, ManagerRegistry, TablesMissing, profile


def row(mid, cik, enabled=True, **extra):
    return {
        "id": mid,
        "cik": cik,
        "name": mid.title(),
        "enabled": enabled,
        "category": "value",
        "sort_order": 0,
        **extra,
    }


class FakeRepo:
    def __init__(self, rows=None, fail=None):
        self.rows = list(rows or [])
        self.fail = fail

    def all(self):
        if self.fail:
            raise self.fail
        return list(self.rows)

    def find(self, manager_id=None, cik=None):
        if self.fail:
            raise self.fail
        return next(
            (
                r
                for r in self.rows
                if (manager_id is not None and r["id"] == manager_id)
                or (manager_id is None and r["cik"] == cik)
            ),
            None,
        )

    def insert(self, value):
        self.rows.append(dict(value))
        return dict(value)

    def update(self, manager_id, values):
        for r in self.rows:
            if r["id"] == manager_id:
                r.update(values)
                return dict(r)
        return None


class RegistryTests(unittest.TestCase):
    def test_serves_builtin_list_until_the_table_is_read(self):
        registry = ManagerRegistry(FakeRepo(fail=RuntimeError("down")))
        self.assertEqual(len(registry), 33)
        self.assertFalse(registry.refresh())
        self.assertEqual(registry["berkshire"], BUILTIN["berkshire"])
        self.assertEqual(registry.source, "builtin")

    def test_loads_only_enabled_rows_in_order(self):
        registry = ManagerRegistry(
            FakeRepo([row("a_one", 1), row("b_two", 2, enabled=False), row("c_three", 3)])
        )
        self.assertTrue(registry.refresh())
        self.assertEqual(list(registry), ["a_one", "c_three"])
        self.assertNotIn("b_two", registry)
        self.assertEqual(registry["a_one"], {"cik": 1, "name": "A_One"})

    def test_failed_refresh_keeps_last_good_snapshot(self):
        repo = FakeRepo([row("a_one", 1)])
        registry = ManagerRegistry(repo)
        registry.refresh()
        repo.fail = RuntimeError("down")
        self.assertFalse(registry.refresh())
        self.assertEqual(list(registry), ["a_one"])

    def test_iteration_is_stable_across_a_refresh(self):
        repo = FakeRepo([row("a_one", 1), row("b_two", 2)])
        registry = ManagerRegistry(repo)
        registry.refresh()
        seen = []
        for mid in registry:
            seen.append(mid)
            repo.rows = [row("z_new", 9)]
            registry.refresh()
        self.assertEqual(seen, ["a_one", "b_two"])
        self.assertEqual(list(registry), ["z_new"])

    def test_public_list_profile(self):
        registry = ManagerRegistry(
            FakeRepo(
                [row("a_one", 1, zh_name="甲", person_en="Ann", role_zh="创始人"), row("b_two", 2)]
            )
        )
        registry.refresh()
        first, second = registry.public_list()
        self.assertEqual(
            first["profile"],
            {
                "zhName": "甲",
                "person": {"en": "Ann", "zh": "Ann"},
                "role": {"en": "创始人", "zh": "创始人"},
            },
        )
        self.assertIsNone(second["profile"])
        self.assertEqual(first["cik"], 1)
        self.assertIsNone(profile({}))


SEC_OK = {
    "cik": 5,
    "sec_name": "NEW FUND LP",
    "latest_13f": {"form": "13F-HR", "period": "2026-09-30"},
    "filings_13f": 4,
}


class AdminRouteTests(unittest.TestCase):
    def setUp(self):
        self.repo = FakeRepo([row("a_one", 1), row("b_two", 2, enabled=False)])
        self.registry = ManagerRegistry(self.repo)
        self.registry.refresh()
        app = FastAPI()
        app.include_router(institutions.router)
        app.dependency_overrides[verify_admin] = lambda: "admin-1"
        self.client = TestClient(app)
        self.patches = [
            patch.object(institutions, "manager_registry", self.registry),
            patch.object(institutions.institution_store, "sync_later"),
        ]
        self.sync_later = [p.start() for p in self.patches][1]
        self.sec = patch.object(institutions, "sec_identity", AsyncMock(return_value=SEC_OK))
        self.sec.start()

    def tearDown(self):
        self.sec.stop()
        for p in self.patches:
            p.stop()

    def test_lists_all_rows_including_disabled(self):
        body = self.client.get("/institutions").json()
        self.assertEqual([r["id"] for r in body["managers"]], ["a_one", "b_two"])
        self.assertEqual(body["enabled"], 1)

    def test_create_enables_and_queues_a_sync(self):
        response = self.client.post(
            "/institutions",
            json={"id": " New_Fund ", "cik": 5, "name": "  New   Fund ", "zh_name": "新基金"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        created = response.json()["manager"]
        self.assertEqual(
            (created["id"], created["name"], created["category"], created["updated_by"]),
            ("new_fund", "New Fund", "other", "admin-1"),
        )
        self.assertIn("new_fund", self.registry)
        self.sync_later.assert_called_once_with("new_fund")

    def test_create_rejects_duplicates_bad_ids_and_non_filers(self):
        self.assertEqual(
            self.client.post("/institutions", json={"id": "a_one", "cik": 9, "name": "X"}).json()[
                "detail"
            ],
            "id_taken",
        )
        self.assertEqual(
            self.client.post("/institutions", json={"id": "zz", "cik": 2, "name": "X"}).json()[
                "detail"
            ],
            "cik_taken",
        )
        for bad in ["1abc", "a", "has-dash", "x" * 41]:
            self.assertEqual(
                self.client.post(
                    "/institutions", json={"id": bad, "cik": 9, "name": "X"}
                ).status_code,
                422,
            )
        self.assertEqual(
            self.client.post(
                "/institutions", json={"id": "zz", "cik": 9, "name": "X", "cik_extra": 1}
            ).status_code,
            422,
        )
        institutions.sec_identity.return_value = {**SEC_OK, "latest_13f": None}
        self.assertEqual(
            self.client.post("/institutions", json={"id": "zz", "cik": 9, "name": "X"}).json()[
                "detail"
            ],
            "no_13f_filings",
        )
        self.assertEqual(len(self.repo.rows), 2)

    def test_enable_candidate_refreshes_and_syncs(self):
        response = self.client.patch("/institutions/b_two", json={"enabled": True})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("b_two", self.registry)
        self.sync_later.assert_called_once_with("b_two")

    def test_disable_removes_from_public_list_without_sync(self):
        self.client.patch("/institutions/a_one", json={"enabled": False})
        self.assertNotIn("a_one", self.registry)
        self.sync_later.assert_not_called()

    def test_update_validation(self):
        self.assertEqual(
            self.client.patch("/institutions/missing", json={"zh_name": "甲"}).status_code, 404
        )
        self.assertEqual(
            self.client.patch("/institutions/a_one", json={}).json()["detail"], "nothing_to_update"
        )
        self.assertEqual(
            self.client.patch("/institutions/a_one", json={"name": "  "}).json()["detail"],
            "name_required",
        )
        self.assertEqual(self.client.patch("/institutions/a_one", json={"cik": 7}).status_code, 422)
        self.assertEqual(
            self.client.patch("/institutions/a_one", json={"enabled": None}).json()["detail"],
            "nothing_to_update",
        )

    def test_missing_table_reports_migration(self):
        self.repo.fail = TablesMissing()
        response = self.client.get("/institutions")
        self.assertEqual((response.status_code, response.json()["detail"]), (503, "tables_missing"))

    def test_lookup_reports_existing_id(self):
        institutions.sec_identity.return_value = {**SEC_OK, "cik": 1}
        body = self.client.get("/institutions/lookup?cik=1").json()
        self.assertEqual(body["existing_id"], "a_one")


if __name__ == "__main__":
    unittest.main()
