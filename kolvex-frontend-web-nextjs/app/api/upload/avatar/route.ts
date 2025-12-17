import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

// POST - 上传头像（支持 multipart/form-data 或 base64）
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    // 处理 multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided" },
          { status: 400 }
        );
      }

      // 创建新的 FormData 发送到后端
      const backendFormData = new FormData();
      backendFormData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}${API_PREFIX}/upload/avatar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: backendFormData,
        }
      );

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    // 处理 JSON（base64 数据）
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { image_data, content_type = "image/jpeg" } = body;

      if (!image_data) {
        return NextResponse.json(
          { success: false, error: "No image data provided" },
          { status: 400 }
        );
      }

      // 创建 FormData 发送 base64 数据
      const formData = new FormData();
      formData.append("image_data", image_data);
      formData.append("content_type", content_type);

      const response = await fetch(
        `${API_BASE_URL}${API_PREFIX}/upload/avatar/base64`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported content type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Upload avatar API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除头像
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("file_path");

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "No file path provided" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/upload/avatar?file_path=${encodeURIComponent(filePath)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Delete avatar API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      },
      { status: 500 }
    );
  }
}

