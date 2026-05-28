interface PhonePeButtonProps {
  invoiceId: string;
  onError: () => void;
}

export const PhonePeButton = ({ invoiceId, onError }: PhonePeButtonProps) => {
  const handleClick = async () => {
    try {
      const res = await fetch("/api/payments/phonepe/create-payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId })
      });
      const json = (await res.json()) as {
        status?: string;
        message?: string;
        data?: { redirectUrl: string };
      };
      if (!res.ok || json.status !== "success" || !json.data?.redirectUrl) {
        throw new Error(json.message ?? "Could not start PhonePe payment");
      }
      window.location.href = json.data.redirectUrl;
    } catch {
      onError();
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="w-full rounded-lg bg-purple-700 px-4 py-3 text-white hover:bg-purple-800"
    >
      Pay with PhonePe
    </button>
  );
};
