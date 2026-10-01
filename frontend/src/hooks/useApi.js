import { useCallback, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

export function useApi(path, deps = [], options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    if (path == null) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data } = await api.get(path, { params: options.params });
      setData(data);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(options.params)]);

  useEffect(() => { run(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData };
}
