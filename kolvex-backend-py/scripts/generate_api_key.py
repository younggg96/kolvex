# scripts/generate_api_key.py
"""
生成安全的 API Key
用于 Dify 等外部服务访问 API
"""

import secrets
import string


def generate_api_key(length: int = 64) -> str:
    """
    生成安全的 API Key

    Args:
        length: Key 长度，默认 64 字符

    Returns:
        str: 格式为 kolvex_xxx 的 API Key
    """
    # 使用安全的随机字符生成
    alphabet = string.ascii_letters + string.digits
    random_part = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"kolvex_{random_part}"


if __name__ == "__main__":
    api_key = generate_api_key()

    print("=" * 70)
    print("🔑 Kolvex API Key Generator")
    print("=" * 70)
    print()
    print("生成的 API Key (请妥善保管，此 Key 不会过期):")
    print()
    print(f"  {api_key}")
    print()
    print("使用方法:")
    print()
    print("1. 将此 Key 添加到 .env 文件:")
    print(f'   DIFY_API_KEY="{api_key}"')
    print()
    print("2. 在 API 请求中添加 Header:")
    print(f"   X-API-Key: {api_key}")
    print()
    print("3. 或在 Dify 中配置 Authentication:")
    print("   Type: API Key")
    print("   Header Name: X-API-Key")
    print(f"   API Key: {api_key}")
    print()
    print("=" * 70)
