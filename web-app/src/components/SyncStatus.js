import React, { useEffect, useState } from 'react';
import kvService from '../services/kvService';

// A small banner that appears only when changes have not reached the server,
// so a failed save is visible instead of silently lost.
function SyncStatus() {
  const [status, setStatus] = useState({ pending: 0, failed: false });

  useEffect(() => kvService.subscribe(setStatus), []);

  // Warn before closing the tab while a save is still on its way.
  useEffect(() => {
    if (status.pending === 0) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status.pending]);

  if (!status.failed) return null;

  return (
    <div className="sync-status" role="status">
      <span>
        ⚠️ Your latest changes are saved on this device but have not reached your account yet. We will keep trying.
      </span>
      <button onClick={() => kvService.retryPending()}>Retry now</button>
    </div>
  );
}

export default SyncStatus;
