"use client";

import Header from "./Header";

interface AdminLoginFormProps {
  password: string;
  error: string;
  onPasswordChange: (password: string) => void;
  onLogin: (e: React.FormEvent) => void;
}

export default function AdminLoginForm({
  password,
  error,
  onPasswordChange,
  onLogin,
}: AdminLoginFormProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full shadow-xl border border-gray-800">
          <h1 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Admin Login
          </h1>
          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium mb-2 text-gray-300">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onLogin(e);
                  }
                }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {error && (
              <div className="bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Login
            </button>
          </form>
        </div>
      </main>
    </>
  );
}


