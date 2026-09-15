"use client";

// Khung chung của app: kiểm tra đăng nhập, header điều hướng, màn hình đăng nhập Google.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AUTH_EXPIRED_EVENT } from "@/lib/api-client";
import { signInWithGoogle, signOutSession } from "@/lib/firebase-client";

interface User {
  uid: string;
  email: string | null;
  name: string | null;
}

const NAV = [
  { href: "/", label: "Danh sách nhân viên" },
  { href: "/tra-cuu", label: "Tra cứu hợp đồng" },
];

// Người dùng tự đóng cửa sổ đăng nhập — không phải lỗi.
const CANCELLED_CODES = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // undefined = đang kiểm tra, null = chưa đăng nhập
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      setUser(res.ok ? (await res.json()).user : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkSession();
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [checkSession]);

  async function login() {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
      await checkSession();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (!CANCELLED_CODES.includes(code)) {
        setError(e instanceof Error ? e.message : "Đăng nhập thất bại.");
      }
    }
    setSigningIn(false);
  }

  async function logout() {
    await signOutSession();
    setUser(null);
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">📄 Hợp đồng - Hồ sơ</span>
        {user && (
          <>
            <nav>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="user-box">
              <span>{user.email}</span>
              <button onClick={logout}>Đăng xuất</button>
            </div>
          </>
        )}
      </header>
      <main>
        {user === undefined && (
          <div className="container">
            <div className="notice info">Đang kiểm tra đăng nhập...</div>
          </div>
        )}
        {user === null && (
          <div className="container">
            <div className="card login-card">
              <h1>Đăng nhập</h1>
              <p>Đăng nhập bằng tài khoản Google để xem và xuất hợp đồng.</p>
              {error && <div className="notice error">{error}</div>}
              <button className="primary" onClick={login} disabled={signingIn}>
                {signingIn ? "Đang đăng nhập..." : "Đăng nhập bằng Google"}
              </button>
            </div>
          </div>
        )}
        {user && children}
      </main>
    </>
  );
}
