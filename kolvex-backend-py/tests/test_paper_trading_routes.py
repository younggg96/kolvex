import unittest
from unittest.mock import Mock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.dependencies.auth import get_current_user_id
from app.api.routes.paper_trading import get_service, router
from app.services.paper_trading.service import PaperTradingService, StorageUnavailable, Conflict


class RouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.service = Mock(spec=PaperTradingService)
        app.dependency_overrides[get_current_user_id] = lambda: "user-a"
        app.dependency_overrides[get_service] = lambda: self.service
        self.client = TestClient(app)

    def body(self, **overrides):
        return {"request_id": str(uuid4()), "action": "order", "symbol": "aapl", "kind": "limit", "price": 100,
                "side": "long", "quantity": 10, **overrides}

    def test_order_uppercases_symbol_and_uses_authenticated_user(self):
        self.service.mutate.return_value = {"version": 1}
        response = self.client.post("/paper-trading/commands", json=self.body())
        self.assertEqual(response.status_code, 200)
        args = self.service.mutate.call_args.args
        self.assertEqual(args[0], "user-a")
        self.assertEqual(args[1]["symbol"], "AAPL")

    def test_reject_forged_price_identity_and_fractional_quantity(self):
        bad = [self.body(user_id="user-b"), self.body(quantity=1.5), self.body(quantity=True),
               self.body(kind="market", price=1), self.body(price=-1), self.body(price="NaN"),
               self.body(side="buy"), self.body(symbol="AAPL/../../"), self.body(quantity=0),
               self.body(kind="limit", price=None), self.body(effect="close"), self.body(request_id="bad")]
        for body in bad:
            with self.subTest(body=body):
                self.assertEqual(self.client.post("/paper-trading/commands", json=body).status_code, 422)
        self.service.mutate.assert_not_called()

    def test_published_snapshot_cannot_be_client_supplied(self):
        body = {"position_id": str(uuid4()), "note": "I learned from this trade", "snapshot": {"realized_pnl": 100000}}
        self.assertEqual(self.client.post("/paper-trading/reviews", json=body).status_code, 422)
        self.service.publish.assert_not_called()

    def test_withdraw_scopes_author_and_id(self):
        rid = str(uuid4())
        self.service.unpublish.return_value = {"ok": True}
        self.assertEqual(self.client.delete("/paper-trading/reviews/" + rid).status_code, 200)
        self.service.unpublish.assert_called_once_with("user-a", rid)

    def test_missing_storage_and_conflict_are_explicit(self):
        for error, status in [(StorageUnavailable(), 503), (Conflict(), 409)]:
            self.service.mutate.side_effect = error
            self.assertEqual(self.client.post("/paper-trading/commands", json=self.body()).status_code, status)

    def test_unauthenticated_request_is_denied(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_service] = lambda: self.service
        self.assertEqual(TestClient(app).get("/paper-trading/account").status_code, 401)


if __name__ == "__main__":
    unittest.main()
