"use client";

import { useEffect } from "react";

export default function FetchInterceptor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const [resource, config] = args;
      
      const activeBranchId = localStorage.getItem("active_branch_id");
      
      if (activeBranchId) {
        if (config) {
          const headers = new Headers(config.headers);
          headers.set("x-requested-branch", activeBranchId);
          config.headers = headers;
        } else {
          // No config provided, need to create one with the header
          args[1] = {
            headers: {
              "x-requested-branch": activeBranchId,
            },
          };
        }
      }

      return originalFetch.apply(this, args as any);
    };

    return () => {
      // Restore original fetch on unmount (though this rarely unmounts)
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
