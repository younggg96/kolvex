import json
from unittest.mock import Mock, patch

import httpx
import pytest

from app.services.x_post_media import UnavailableMedia, archive_media, fetch_media, normalize_source

POST_ID = "2123543880780132572"
IMAGE = {
    "kind": "image",
    "url": "https://pbs.twimg.com/media/Chart?format=jpg&name=small&private=ignored",
    "source_url": f"https://x.com/TestUser/status/{POST_ID}/photo/1",
    "alt": "Revenue comparison",
}
IMAGE_BYTES = b"\xff\xd8\xfftest"


@pytest.mark.parametrize(
    "change",
    [
        {"url": "http://pbs.twimg.com/media/Chart"},
        {"url": "https://pbs.twimg.com.attacker.invalid/media/Chart"},
        {"url": "https://pbs.twimg.com@localhost/media/Chart"},
        {"url": "https://pbs.twimg.com/profile_images/avatar.jpg"},
        {"source_url": "https://x.com/someone_else/status/10/photo/1"},
        {"kind": "video"},
    ],
)
def test_rejects_unrelated_or_unsafe_media(change):
    assert normalize_source({**IMAGE, **change}, "testuser", POST_ID) is None


def test_image_and_video_urls_keep_only_public_cdn_parameters():
    image = normalize_source(IMAGE, "testuser", POST_ID)
    assert image["url"] == "https://pbs.twimg.com/media/Chart?name=large&format=jpg"
    video = normalize_source(
        {
            "kind": "video",
            "url": "https://video.twimg.com/ext_tw_video/100/pu/vid/640x360/movie.mp4?tag=12&other=1",
            "source_url": f"https://x.com/TestUser/status/{POST_ID}/video/1",
        },
        "testuser",
        POST_ID,
    )
    assert video["url"].endswith("movie.mp4?tag=12")


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(302, headers={"location": "http://localhost/"}),
        httpx.Response(200, headers={"content-type": "image/jpeg"}, content=b"<h1>error</h1>"),
        httpx.Response(
            200,
            headers={"content-type": "image/jpeg", "content-length": str(11 * 1024 * 1024)},
            content=IMAGE_BYTES,
        ),
    ],
)
def test_does_not_archive_redirects_non_media_or_oversized_files(response):
    source = normalize_source(IMAGE, "testuser", POST_ID)
    with (
        httpx.Client(transport=httpx.MockTransport(lambda _: response)) as client,
        pytest.raises(UnavailableMedia),
    ):
        fetch_media(client, source)


def test_retries_uncommitted_upload_and_records_only_after_storage_success(tmp_path):
    run = tmp_path / "run"
    run.mkdir()
    manifest = run / "testuser-media.json"
    manifest.write_text(
        json.dumps(
            {"handle": "testuser", "posts": [{"id": POST_ID, "media_sources": [IMAGE, IMAGE]}]}
        )
    )
    db = Mock()
    bucket = db.storage.from_.return_value
    bucket.get_public_url.side_effect = lambda path: f"https://example.supabase.co/{path}"
    bucket.upload.side_effect = [RuntimeError("sensitive provider error"), None]
    query = db.table.return_value.select.return_value
    query.eq.return_value.eq.return_value.in_.return_value.execute.return_value = Mock(
        data=[{"id": POST_ID, "media_assets": []}]
    )
    with patch(
        "app.services.x_post_media.fetch_media", return_value=(IMAGE_BYTES, "image/jpeg", "jpg")
    ):
        failed = archive_media(db, tmp_path)
        assert failed["pending_manifests"] == 1
        assert not manifest.with_suffix(".done").exists()
        assert "sensitive" not in json.dumps(failed)
        db.rpc.assert_not_called()

        success = archive_media(db, tmp_path)
        assert success["archived"] == success["images"] == 1
        assert manifest.with_suffix(".done").exists()
        assert archive_media(db, tmp_path)["archived"] == 0

    assert bucket.upload.call_args_list[0] == bucket.upload.call_args_list[1]
    command, saved = db.rpc.call_args.args
    assert command == "record_x_post_media"
    assert saved["post_id"] == POST_ID
    assert saved["asset"]["url"].startswith("https://example.supabase.co/")


def test_backfill_upload_can_reuse_validated_local_bytes(tmp_path):
    run = tmp_path / "run"
    folder = run / "attachments" / POST_ID
    folder.mkdir(parents=True)
    candidate = normalize_source(IMAGE, "testuser", POST_ID)
    (folder / f"{candidate['key']}.jpg").write_bytes(IMAGE_BYTES)
    (run / "testuser-media.json").write_text(
        json.dumps({"handle": "testuser", "posts": [{"id": POST_ID, "media_sources": [IMAGE]}]})
    )
    db = Mock()
    query = db.table.return_value.select.return_value
    query.eq.return_value.eq.return_value.in_.return_value.execute.return_value = Mock(
        data=[{"id": POST_ID, "media_assets": []}]
    )

    with patch("app.services.x_post_media.fetch_media") as fetch:
        result = archive_media(db, tmp_path)
    assert result["archived"] == 1
    fetch.assert_not_called()
