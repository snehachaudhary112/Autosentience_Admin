import { useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple password check - in production, use proper authentication
    if (password === "admin123") {
      localStorage.setItem("isAdmin", "true");
      router.push("/admin");
    } else {
      alert("Invalid password");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #111827, #1f2937)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1f2937",
          padding: "32px",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          width: "384px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(to right, #3b82f6, #9333ea)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              background: "linear-gradient(to right, #3b82f6, #9333ea)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.3)",
            }}
          >
            <svg
              style={{ width: "30px", height: "30px", color: "white" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: "white",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          Admin Login
        </h1>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                color: "#d1d5db",
                fontSize: "14px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#374151",
                color: "white",
                borderRadius: "8px",
                border: "1px solid #4b5563",
                outline: "none",
                transition: "all 0.2s ease",
                fontSize: "16px",
              }}
              placeholder="Enter admin password"
              onFocus={(e) => {
                e.target.style.borderColor = "#3b82f6";
                e.target.style.boxShadow = "0 0 0 2px rgba(59, 130, 246, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#4b5563";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: "100%",
              background: "linear-gradient(to right, #3b82f6, #2563eb)",
              color: "white",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              marginBottom: "16px",
            }}
            onMouseEnter={(e) => {
              e.target.style.background =
                "linear-gradient(to right, #2563eb, #1d4ed8)";
              e.target.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background =
                "linear-gradient(to right, #3b82f6, #2563eb)";
              e.target.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
            }}
          >
            Login
          </button>
        </form>
        <div
          style={{
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: "8px",
            padding: "12px",
            marginTop: "16px",
          }}
        >
          {/* <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', margin: 0 }}>
            Demo password: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>admin123</span>
          </p> */}
        </div>
      </div>
    </div>
  );
}
