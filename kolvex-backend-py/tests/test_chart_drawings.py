import unittest
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes import chart_drawings
from app.services.chart_drawings import ChartDrawingsService, ChartDrawingsUnavailable


def trend(**overrides):
    return {
        "id": "a1",
        "type": "trend",
        "points": [{"time": 1_780_000_000_000, "price": 180.5}, {"time": 1_781_000_000_000, "price": 190}],
        "color": "rgb(41 98 255)",
        **overrides,
    }


class ChartDrawingRouteTests(unittest.TestCase):
    def setUp(self):
        self.service = Mock(spec=ChartDrawingsService)
        app = FastAPI()
        app.include_router(chart_drawings.router)
        app.dependency_overrides[get_current_user_id] = lambda: "user-1"
        app.dependency_overrides[chart_drawings.get_service] = lambda: self.service
        self.client = TestClient(app)

    def test_save_uppercases_ticker_and_scopes_to_user(self):
        self.service.save.return_value = {"ticker": "NVDA", "drawings": [trend()], "updated_at": "2026-10-08T00:00:00+00:00"}
        response = self.client.put("/chart-drawings/nvda", json={"drawings": [trend()]})
        self.assertEqual(response.status_code, 200)
        user_id, ticker, drawings = self.service.save.call_args.args
        self.assertEqual((user_id, ticker), ("user-1", "NVDA"))
        self.assertEqual(drawings[0]["points"][1]["price"], 190)

    def test_rejects_wrong_point_count_unknown_type_and_unsafe_color(self):
        for bad in (
            trend(type="hline"),
            trend(type="spline"),
            trend(color="url(javascript:alert(1))"),
            trend(points=[{"time": 1, "price": None}, {"time": 2, "price": 1}]),
            trend(points=[{"time": 1, "price": 1}, {"time": 2, "price": 1}, {"time": 3, "price": 1}]),
        ):
            response = self.client.put("/chart-drawings/NVDA", json={"drawings": [bad]})
            self.assertEqual(response.status_code, 422, bad)
        self.service.save.assert_not_called()

    def test_single_point_horizontal_line_and_theme_color_are_accepted(self):
        hline = trend(type="hline", points=[{"time": 1, "price": 200}], color="rgb(var(--foreground))")
        self.service.save.return_value = {"ticker": "NVDA", "drawings": [hline], "updated_at": None}
        self.assertEqual(self.client.put("/chart-drawings/NVDA", json={"drawings": [hline]}).status_code, 200)

    def test_missing_table_reports_unavailable(self):
        self.service.get.side_effect = ChartDrawingsUnavailable("PGRST205")
        self.assertEqual(self.client.get("/chart-drawings/NVDA").status_code, 503)


class ChartDrawingServiceTests(unittest.TestCase):
    def test_get_returns_empty_list_without_a_row(self):
        supabase = Mock()
        supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        result = ChartDrawingsService(supabase).get("user-1", "NVDA")
        self.assertEqual(result, {"ticker": "NVDA", "drawings": [], "updated_at": None})

    def test_clearing_keeps_a_row_so_other_devices_see_the_clear(self):
        supabase = Mock()
        result = ChartDrawingsService(supabase).save("user-1", "NVDA", [])
        row = supabase.table.return_value.upsert.call_args.args[0]
        self.assertEqual(row["drawings"], [])
        self.assertEqual(row["updated_at"], result["updated_at"])

    def test_missing_table_error_is_translated(self):
        supabase = Mock()
        supabase.table.return_value.upsert.return_value.execute.side_effect = Exception(
            "{'code': 'PGRST205', 'message': \"Could not find the table 'public.user_chart_drawings'\"}"
        )
        with self.assertRaises(ChartDrawingsUnavailable):
            ChartDrawingsService(supabase).save("user-1", "NVDA", [])


if __name__ == "__main__":
    unittest.main()
