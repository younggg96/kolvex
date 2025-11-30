import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "./config";

/**
 * 创建浏览器端 Supabase 客户端，使用 cookie 存储 session
 *
 * 这样配置的好处：
 * 1. Session 会自动存储在 httpOnly cookie 中，更安全
 * 2. 服务端和客户端共享同一个 session
 * 3. 自动处理 session 刷新
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // 只在浏览器环境中访问 document
        if (typeof document === "undefined") {
          return undefined;
        }
        // 从 document.cookie 中获取 cookie
        const cookie = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split("=")[1]) : undefined;
      },
      set(name: string, value: string, options: any) {
        // 只在浏览器环境中访问 document
        if (typeof document === "undefined") {
          return;
        }
        // 设置 cookie 到 document.cookie
        let cookie = `${name}=${encodeURIComponent(value)}`;

        if (options?.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }
        if (options?.domain) {
          cookie += `; domain=${options.domain}`;
        }
        if (options?.path) {
          cookie += `; path=${options.path}`;
        } else {
          cookie += "; path=/";
        }
        if (options?.sameSite) {
          cookie += `; samesite=${options.sameSite}`;
        } else {
          cookie += "; samesite=lax";
        }
        if (options?.secure) {
          cookie += "; secure";
        }

        document.cookie = cookie;
      },
      remove(name: string, options: any) {
        // 只在浏览器环境中访问 document
        if (typeof document === "undefined") {
          return;
        }
        // 删除 cookie
        let cookie = `${name}=; max-age=0`;

        if (options?.domain) {
          cookie += `; domain=${options.domain}`;
        }
        if (options?.path) {
          cookie += `; path=${options.path}`;
        } else {
          cookie += "; path=/";
        }

        document.cookie = cookie;
      },
    },
  });
}
