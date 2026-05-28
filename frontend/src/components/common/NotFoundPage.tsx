import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <main className="mx-auto max-w-xl p-8 text-center">
    <h1 className="font-heading text-4xl text-gray-900">404</h1>
    <p className="mt-3 text-gray-600">Page not found.</p>
    <Link className="mt-6 inline-block rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700" to="/admin/login">
      Go to Login
    </Link>
  </main>
);
