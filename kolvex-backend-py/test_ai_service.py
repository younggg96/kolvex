#!/usr/bin/env python3
"""
测试 AI 服务是否可用

使用方式:
    python test_ai_service.py
"""

def test_ai_service():
    """测试 AI 服务"""
    print("=" * 60)
    print("🧪 测试 Ollama AI 服务")
    print("=" * 60)
    
    try:
        from app.services.ai import OllamaClientSync, TweetAnalyzerSync
        
        # 1. 健康检查
        print("\n📋 步骤 1: 检查 Ollama 服务...")
        client = OllamaClientSync()
        
        if not client.health_check():
            print("❌ AI 服务不可用\n")
            print("可能的原因：")
            print("  1. Ollama 服务未启动")
            print("  2. Ollama 未安装")
            print("  3. 端口 11434 被占用\n")
            print("解决方案：")
            print("  方案 1 (不使用 AI):")
            print("    - 爬虫仍可正常工作，只是没有 AI 分析")
            print("    - 不需要任何操作，警告可以忽略\n")
            print("  方案 2 (安装 Ollama):")
            print("    1. 安装 Ollama:")
            print("       macOS: brew install ollama")
            print("       Linux: curl -fsSL https://ollama.ai/install.sh | sh")
            print("    2. 启动服务: ollama serve")
            print("    3. 下载模型: ollama pull llama3.2:1b")
            print("    4. 重新运行测试\n")
            print("详细说明请查看: AI_SERVICE_SETUP.md")
            return False
        
        print("✅ Ollama 服务运行中")
        print(f"   连接地址: {client.base_url}")
        print(f"   使用模型: {client.model}")
        
        # 2. 测试模型可用性
        print("\n📋 步骤 2: 测试模型...")
        try:
            test_prompt = "Hello"
            response = client.generate(test_prompt, max_tokens=10)
            print(f"✅ 模型响应正常")
            print(f"   测试响应: {response[:50]}...")
        except Exception as e:
            print(f"❌ 模型测试失败: {e}")
            print("\n可能需要下载模型:")
            print(f"   ollama pull {client.model}")
            return False
        
        # 3. 测试文本分析
        print("\n📋 步骤 3: 测试股票分析...")
        analyzer = TweetAnalyzerSync(client)
        
        test_text = """
英伟达（NVDA）今日股价上涨 5%，
受益于 AI 芯片需求强劲。
多位分析师建议买入。
特斯拉（TSLA）股价下跌 2%。
"""
        
        try:
            result = analyzer.basic_analysis(test_text)
            
            sentiment = result.get('sentiment', {})
            tickers = result.get('tickers', [])
            signal = result.get('trading_signal')
            
            print("✅ 分析成功！")
            print(f"\n📊 分析结果:")
            print(f"   情感: {sentiment.get('sentiment', 'N/A')}")
            print(f"   置信度: {sentiment.get('confidence', 0):.2f}")
            print(f"   股票代码: {tickers if tickers else '无'}")
            print(f"   交易信号: {signal or '无'}")
            
            if result.get('summary'):
                print(f"   摘要: {result['summary'][:100]}...")
            
        except Exception as e:
            print(f"❌ 分析失败: {e}")
            return False
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！AI 服务工作正常")
        print("=" * 60)
        print("\n现在可以使用完整的 AI 功能进行爬取:")
        print("  python -m app.services.xiaohongshu 美股")
        
        return True
        
    except ImportError as e:
        print(f"❌ 导入错误: {e}")
        print("\n可能缺少依赖，请运行:")
        print("  pip install httpx python-dotenv")
        return False
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    success = test_ai_service()
    sys.exit(0 if success else 1)

