"""Authentication requests must not retain or rotate browser sessions globally."""
import asyncio
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from gotrue.types import AuthResponse, Session, User
from app.core import supabase as clients
from app.api.routes.auth import routes


def auth_response(user_id, token):
    user = User(
        id=user_id, aud="authenticated", email=f"{user_id}@example.com",
        app_metadata={}, user_metadata={}, created_at="2026-10-10T00:00:00Z",
    )
    session = Session(
        access_token=token, refresh_token=f"refresh-{token}", token_type="bearer",
        expires_in=3600, expires_at=int(time.time()) + 3600, user=user,
    )
    return AuthResponse(user=user, session=session)


class AuthSessionTests(unittest.TestCase):
    def setUp(self):
        self.settings = patch.object(clients, "settings", SimpleNamespace(
            SUPABASE_URL="https://session-test.supabase.co",
            SUPABASE_KEY="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.test",
            SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test",
        ))
        self.settings.start()
        self.addCleanup(self.settings.stop)
        clients.SupabaseClient.reset_client()
        self.addCleanup(clients.SupabaseClient.reset_client)

    def test_login_requests_have_independent_sessions_and_never_start_refresh_timers(self):
        first, second = clients.get_supabase(), clients.get_supabase()
        self.assertIsNot(first, second)
        first_response = auth_response("user-a", "access-a")
        second_response = auth_response("user-b", "access-b")
        with patch("gotrue._sync.gotrue_client.Timer") as timer:
            with patch.object(first.auth, "_request", return_value=first_response):
                first.auth.sign_in_with_password({"email": "user-a@example.com", "password": "test"})
            with patch.object(second.auth, "_request", return_value=second_response):
                second.auth.sign_in_with_password({"email": "user-b@example.com", "password": "test"})
            timer.assert_not_called()
        self.assertFalse(first.auth._auto_refresh_token)
        self.assertFalse(first.auth._persist_session)
        self.assertEqual(first.auth.get_session().user.id, "user-a")
        self.assertEqual(second.auth.get_session().user.id, "user-b")
        self.assertEqual(first.options.headers["Authorization"], "Bearer access-a")
        self.assertEqual(second.options.headers["Authorization"], "Bearer access-b")
        self.assertIsNone(clients.get_supabase().auth.get_session())

    def test_explicit_refresh_returns_rotated_tokens_without_background_refresh(self):
        client = clients.get_supabase()
        response = auth_response("user-a", "rotated-access")
        with patch.object(client.auth, "_request", return_value=response) as request:
            with patch("gotrue._sync.gotrue_client.Timer") as timer:
                result = client.auth.refresh_session("browser-refresh")
                timer.assert_not_called()
        self.assertEqual(result.session.refresh_token, "refresh-rotated-access")
        self.assertEqual(request.call_args.kwargs["body"]["refresh_token"], "browser-refresh")
        self.assertIsNone(clients.get_supabase().auth.get_session())

    def test_logout_uses_request_token_instead_of_shared_client_session(self):
        client = Mock()
        with patch.object(routes, "get_supabase", return_value=client):
            result = asyncio.run(routes.sign_out("Bearer caller-token"))
        self.assertTrue(result.success)
        client.auth.admin.sign_out.assert_called_once_with("caller-token")
        client.auth.sign_out.assert_not_called()

    def test_missing_or_malformed_logout_token_does_not_touch_other_sessions(self):
        for value in [None, "invalid", "Basic caller-token"]:
            with patch.object(routes, "get_supabase") as factory:
                self.assertTrue(asyncio.run(routes.sign_out(value)).success)
                factory.assert_not_called()

    def test_service_client_does_not_persist_or_auto_refresh_user_sessions(self):
        client = clients.get_supabase_service()
        self.assertIs(client, clients.get_supabase_service())
        self.assertFalse(client.auth._auto_refresh_token)
        self.assertFalse(client.auth._persist_session)
        self.assertIsNone(client.auth.get_session())


if __name__ == "__main__":
    unittest.main()
