import { apiURL } from "./config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** The backend's machine-readable `detail` code, when it sent one. */
    public detail?: string,
  ) {
    super(message);
  }
}
type Identity = { token: string; userId: string } | null;
let identity: () => Promise<Identity> = async () => null;
export function configureIdentity(getter: () => Promise<Identity>) {
  identity = getter;
}
export function errorForStatus(status: number) {
  if (status === 401) return "登录已过期，请返回账户页重新登录。";
  if (status === 403) return "当前账户没有访问此内容的权限。";
  if (status === 404) return "内容不存在或已被移除。";
  if (status === 409)
    return "内容已变化或请求结果尚未确认，请刷新核对后再操作。";
  if (status === 422) return "提交内容不符合要求，请检查字段后重试。";
  if (status === 429) return "请求较频繁，请稍后重试。";
  return `服务暂时不可用（${status}），请稍后重试。`;
}
type Options = {
  signal?: AbortSignal;
  authenticated?: boolean;
  expectedUser?: string;
  method?: string;
  body?: unknown;
  form?: FormData;
  timeout?: number;
  stream?: boolean;
  revision?: string;
};
export async function apiRequest<T>(
  path: string,
  options: Options = {},
): Promise<T> {
  const response = await apiResponse(path, options);
  if (response.status === 204) return undefined as T;
  try {
    return await response.json();
  } catch {
    throw new Error("服务返回了无效数据，请重试。");
  }
}
export async function apiResponse(
  path: string,
  options: Options = {},
): Promise<Response> {
  if (!apiURL)
    throw new Error("尚未配置后端连接，请在应用环境中设置 API 地址。");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://"))
    throw new Error("无效的 API 路径。");
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeout ?? 20000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.authenticated) {
      const account = await identity();
      if (!account) throw new ApiError("请先登录后再查看此内容。", 401);
      if (options.expectedUser && account.userId !== options.expectedUser)
        throw new ApiError("账户已切换，请重新打开页面。", 409);
      headers.Authorization = `Bearer ${account.token}`;
    }
    if (options.revision !== undefined) headers["If-Match"] = options.revision;
    if (options.body !== undefined && !options.form)
      headers["Content-Type"] = "application/json";
    const response = await fetch(`${apiURL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.form ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: options.stream ? options.signal : controller.signal,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const detail = (body as { detail?: unknown } | null)?.detail;
      throw new ApiError(
        errorForStatus(response.status),
        response.status,
        typeof detail === "string" ? detail : undefined,
      );
    }
    if (
      options.authenticated &&
      options.expectedUser &&
      (await identity())?.userId !== options.expectedUser
    )
      throw new ApiError("账户已切换，请重新打开页面。", 409);
    return response;
  } catch (error) {
    if (timedOut)
      throw new Error(
        (options.method ?? "GET") === "GET"
          ? "连接超时，请检查网络后重试。"
          : "连接超时，操作可能已提交。请刷新查看最新状态。",
      );
    if (error instanceof TypeError)
      throw new Error("无法连接服务，请检查网络后重试。");
    throw error;
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener("abort", abort);
  }
}
