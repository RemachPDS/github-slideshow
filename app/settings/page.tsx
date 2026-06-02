"use client";

import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ?? "MirrorEngineBot";

  async function generateToken() {
    setLoading(true);
    const res = await fetch("/api/telegram/link", { method: "POST" });
    const data = await res.json();
    setToken(data.token);
    setLoading(false);
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/checkin" className="text-xs text-gray-400 hover:text-gray-600">
            ← volver
          </Link>
        </div>

        <h1 className="text-lg font-medium text-gray-900 mb-6">Ajustes</h1>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-1">Telegram</h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Vinculá tu cuenta para hacer check-ins y recibir insights directamente en Telegram — sin abrir la app.
          </p>

          {!token ? (
            <button
              onClick={generateToken}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50 transition-colors"
            >
              {loading ? "Generando..." : "Conectar Telegram"}
            </button>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Abrí <strong>@{botName}</strong> en Telegram y enviá este mensaje:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-800 select-all mb-3">
                /link {token}
              </div>
              <p className="text-xs text-gray-400">
                El token es de un solo uso. Si no lo usás, podés generar otro.
              </p>
              <button
                onClick={() => setToken(null)}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600"
              >
                Generar otro token
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
