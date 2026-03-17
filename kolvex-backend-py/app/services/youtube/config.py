"""
YouTube scraper configuration
"""

import os

PLATFORM_YOUTUBE = "youtube"

ENABLE_AI_ANALYSIS = os.getenv("ENABLE_AI_ANALYSIS", "true").lower() == "true"

YOUTUBE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

DEFAULT_MAX_VIDEOS_PER_CHANNEL = int(
    os.getenv("YOUTUBE_MAX_VIDEOS_PER_CHANNEL", "5")
)
DEFAULT_VIDEO_MAX_AGE_DAYS = int(os.getenv("YOUTUBE_VIDEO_MAX_AGE_DAYS", "7"))

MAX_TRANSCRIPT_CHARS = 12000

# Default finance KOL channels: (channel_id, handle, display_name)
DEFAULT_YOUTUBE_KOLS = [
    ("UCUyBt6gqMDmR2h9OqXYhEQ", "@MeetKevin", "Meet Kevin"),
    ("UCkcnYVAVZQOB-nXHeEGLtDg", "@StockMoe", "Stock Moe"),
    ("UCnMn36GT_H0X-w5_ckLtlgQ", "@FinancialEducation", "Financial Education"),
    ("UC3iOG8v2u9R0Kzf5PBg8NfA", "@TomNashYT", "Tom Nash"),
    ("UC4oDa3qNf4FVHXFHZ6FjtcA", "@TickerSymbolYOU", "Ticker Symbol: YOU"),
    ("UCbfYPcUPkNiGI2fWLu5KMdA", "@EverythingMoney", "Everything Money"),
]
