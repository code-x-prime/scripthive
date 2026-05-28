import { useParams } from "react-router-dom";

export const InvoiceViewPage = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <section>
      <h1 className="font-heading text-3xl text-gray-900">Invoice</h1>
      <p className="font-mono text-gray-600">{id}</p>
    </section>
  );
};
