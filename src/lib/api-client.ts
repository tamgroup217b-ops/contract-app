// fetch dùng trong các trang: khi server báo hết phiên (401) thì báo AppShell hiện lại màn hình đăng nhập.

export const AUTH_EXPIRED_EVENT = "auth-expired";

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  return res;
}
