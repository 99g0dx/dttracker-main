import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCompanyAdmin } from '../../hooks/useCompanyAdmin';

type CompanyAdminRouteProps = {
  children: React.ReactNode;
};

export function CompanyAdminRoute({ children }: CompanyAdminRouteProps) {
  const { isCompanyAdmin, loading } = useCompanyAdmin();

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-400">
        Loading...
      </div>
    );
  }

  if (!isCompanyAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
