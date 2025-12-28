"""
Dataroma 爬虫配置
"""

# 网站 URL
DATAROMA_BASE_URL = "https://www.dataroma.com/m"
MANAGERS_URL = f"{DATAROMA_BASE_URL}/managers.php"
HOLDINGS_URL = f"{DATAROMA_BASE_URL}/holdings.php"
ACTIVITY_URL = f"{DATAROMA_BASE_URL}/activity.php"

# 请求头
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# 请求超时（秒）
REQUEST_TIMEOUT = 30

# 请求间隔（秒），避免被封
REQUEST_DELAY = 1.0

# 重试配置
MAX_RETRIES = 3
RETRY_DELAY = 5

# 13F 报告季度（每年的截止日期）
# Q1: 3月31日 -> 5月15日前申报
# Q2: 6月30日 -> 8月15日前申报
# Q3: 9月30日 -> 11月15日前申报
# Q4: 12月31日 -> 2月15日前申报
QUARTER_FILING_DATES = {
    "Q1": {"end_date": "03-31", "filing_deadline": "05-15"},
    "Q2": {"end_date": "06-30", "filing_deadline": "08-15"},
    "Q3": {"end_date": "09-30", "filing_deadline": "11-15"},
    "Q4": {"end_date": "12-31", "filing_deadline": "02-15"},
}

