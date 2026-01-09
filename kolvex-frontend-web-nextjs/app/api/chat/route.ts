import { NextRequest, NextResponse } from "next/server";

// Ollama API 配置
// 使用 127.0.0.1 而不是 localhost 来避免 IPv6 连接问题
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
// 使用金融专用模型以获得更好的股票分析结果
const DEFAULT_MODEL =
  process.env.OLLAMA_MODEL ||
  "hf.co/QuantFactory/Llama-3-8B-Instruct-Finance-RAG-GGUF:Q4_K_M";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: Message[];
  model?: string;
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, model = DEFAULT_MODEL, stream = true } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // 添加系统提示词
    const systemPrompt: Message = {
      role: "system",
      content: `You are Kolvex AI, an intelligent financial assistant specialized in stocks, markets, and investments. You are helpful, concise, and provide accurate financial insights. You can discuss:
- Stock analysis and market trends
- Investment strategies and portfolio management  
- Financial news and economic indicators
- Technical and fundamental analysis
- Risk management and diversification

Always provide balanced perspectives and remind users that your insights are for educational purposes, not financial advice.`,
    };

    const allMessages = [systemPrompt, ...messages];

    // 如果是流式响应
    if (stream) {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API error:", errorText);
        return NextResponse.json(
          { error: `Ollama API error: ${response.statusText}` },
          { status: response.status }
        );
      }

      // 创建一个 TransformStream 来处理流式响应
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = decoder.decode(chunk);
          const lines = text.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                // 发送 SSE 格式的数据
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      content: json.message.content,
                      done: json.done,
                    })}\n\n`
                  )
                );
              }
              if (json.done) {
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              }
            } catch {
              // 忽略解析错误
            }
          }
        },
      });

      const readableStream = response.body?.pipeThrough(transformStream);

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 非流式响应
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error:", errorText);
      return NextResponse.json(
        { error: `Ollama API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      message: data.message,
      model: data.model,
      done: data.done,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to connect to Ollama. Make sure Ollama is running locally.",
      },
      { status: 500 }
    );
  }
}

// 获取可用模型列表
export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch models" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ models: data.models || [] });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: "Failed to connect to Ollama" },
      { status: 500 }
    );
  }
}
