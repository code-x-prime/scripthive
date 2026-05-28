import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

interface PayPalButtonProps {
  invoiceId: string;
  clientId: string;
  onSuccess: (transactionId: string) => void;
  onError: () => void;
}

export const PayPalButton = ({ invoiceId, clientId, onSuccess, onError }: PayPalButtonProps) => {
  if (!clientId) {
    return <p className="text-sm text-amber-700">PayPal is not configured. Add keys in Admin → Settings → Payment gateways.</p>;
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "USD",
        intent: "capture"
      }}
    >
      <PayPalButtons
        createOrder={async () => {
          const response = await fetch("/api/payments/paypal/create-order", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId })
          });
          const payload = (await response.json()) as { data: { orderId: string }; message?: string };
          if (!response.ok) throw new Error(payload.message ?? "PayPal order failed");
          return payload.data.orderId;
        }}
        onApprove={async (data) => {
          const response = await fetch("/api/payments/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: data.orderID, invoiceId })
          });
          const payload = (await response.json()) as { data: { transactionId: string }; message?: string };
          if (!response.ok) throw new Error(payload.message ?? "PayPal capture failed");
          onSuccess(payload.data.transactionId);
        }}
        onError={onError}
      />
    </PayPalScriptProvider>
  );
};
