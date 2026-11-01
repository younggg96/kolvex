export function safeExternal(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
export function credentialsError(
  email: string,
  password: string,
  register: boolean,
) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "请输入有效的邮箱地址。";
  if (!password) return "请输入密码。";
  if (register && password.length < 6) return "密码至少需要 6 位。";
  return undefined;
}
