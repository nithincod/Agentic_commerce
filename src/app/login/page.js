"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  async function handleGitHubLogin() {
    await signIn("github", {
      callbackUrl: "/buyer",
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          border:
            "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "32px",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.08)",
          background:
            "#ffffff",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 700,
          }}
        >
          Sign in to AgentPay
        </h1>

        <p
          style={{
            marginTop: "10px",
            color: "#6b7280",
          }}
        >
          Continue with your GitHub account.
        </p>

        <button
          type="button"
          onClick={
            handleGitHubLogin
          }
          style={{
            width: "100%",
            marginTop: "24px",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
            background: "#111827",
            color: "#ffffff",
          }}
        >
          Continue with GitHub
        </button>
      </div>
    </main>
  );
}