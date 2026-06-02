import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CheckinForm } from "@/components/CheckinForm";
import Link from "next/link";

export default async function CheckinPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Espejo cognitivo</p>
          <h1 className="text-lg font-medium text-gray-900">Check-in</h1>
          <p className="text-sm text-gray-400 mt-1">
            Completá los días que tenés. Mínimo 2 para generar patrones.
          </p>
        </div>
        <div className="flex gap-3 text-xs text-gray-400 mt-1">
          <Link href="/stats" className="hover:text-gray-600">dataset</Link>
          <Link href="/settings" className="hover:text-gray-600">ajustes</Link>
        </div>
      </div>
      <CheckinForm />
    </main>
  );
}
