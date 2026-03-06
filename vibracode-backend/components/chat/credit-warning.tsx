"use client";

interface CreditWarningProps {
  balance: number;
}

export function CreditWarning({ balance }: CreditWarningProps) {
  return (
    <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
      <p className="text-sm text-destructive font-medium text-center">
        Insufficient credits (${balance.toFixed(2)} remaining)
      </p>
      <p className="text-xs text-destructive/80 text-center mt-1">
        Add credits to continue sending messages
      </p>
    </div>
  );
}

