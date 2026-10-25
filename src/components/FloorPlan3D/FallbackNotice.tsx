import React from 'react';

export const FallbackNotice: React.FC<{ onBack: () => void; onRetry?: () => void }> = ({ onBack, onRetry }) => (
  <div className="flex h-full min-h-[320px] items-center justify-center bg-stone-100 p-6 text-center">
    <div>
      <p className="text-sm font-medium text-stone-800">3D isn&apos;t available on this device.</p>
      <p className="mt-1 text-xs text-stone-500">Open the 2D plan or try enabling hardware acceleration.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button className="rounded-lg bg-stone-800 px-3 py-2 text-xs text-white" onClick={onBack}>Back to 2D plan</button>
        {onRetry && <button className="rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-700" onClick={onRetry}>Retry</button>}
      </div>
    </div>
  </div>
);
