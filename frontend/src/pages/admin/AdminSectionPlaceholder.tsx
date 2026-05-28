export const AdminSectionPlaceholder = ({ title }: { title: string }) => (
  <section className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
    <h1 className="font-heading text-2xl text-gray-900">{title}</h1>
    <p className="mt-2 text-sm text-gray-500">
      This area is routed and permission-guarded. Full workflow UI can be extended here without changing navigation.
    </p>
  </section>
);
