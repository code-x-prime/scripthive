export const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
    <p className="font-heading text-2xl text-gray-900">{title}</p>
    <p className="mt-2 text-gray-500">{description}</p>
  </div>
);
