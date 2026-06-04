import { login, signup } from "./actions";
import { GoogleButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-gray-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            PartSnap
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to list parts in seconds.
          </p>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <button
            formAction={login}
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-gray-800"
          >
            Sign in
          </button>
          <button
            formAction={signup}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-900 transition hover:bg-gray-50"
          >
            Create account
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          OR
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <GoogleButton />
      </div>
    </main>
  );
}
