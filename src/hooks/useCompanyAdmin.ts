import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useCompanyAdmin() {
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      try {
        const { data, error } = await supabase.rpc('is_company_admin');
        if (!isMounted) return;
        if (error) {
          setIsCompanyAdmin(false);
          setLoading(false);
          return;
        }
        setIsCompanyAdmin(Boolean(data));
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setIsCompanyAdmin(false);
        setLoading(false);
      }
    };

    check();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isCompanyAdmin, loading };
}
