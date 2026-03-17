"""
YouTube video transcript extraction using youtube-transcript-api
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def get_transcript(video_id: str, max_chars: int = 12000) -> Optional[str]:
    """
    Extract transcript text for a YouTube video.

    Tries English first, then falls back to auto-generated captions,
    then to any available language.

    Returns:
        Concatenated transcript text truncated to *max_chars*, or None.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        transcript = None

        # 1. Manual English transcript
        try:
            transcript = transcript_list.find_manually_created_transcript(["en"])
        except Exception:
            pass

        # 2. Auto-generated English
        if transcript is None:
            try:
                transcript = transcript_list.find_generated_transcript(["en"])
            except Exception:
                pass

        # 3. Any available transcript, translated to English
        if transcript is None:
            try:
                for t in transcript_list:
                    transcript = t.translate("en")
                    break
            except Exception:
                pass

        if transcript is None:
            return None

        entries = transcript.fetch()
        text = " ".join(entry.get("text", "") for entry in entries)
        return text[:max_chars] if text else None

    except Exception as e:
        logger.debug(f"Transcript unavailable for {video_id}: {e}")
        return None
