import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <div className="mt-1 text-sm text-gray-500">{description}</div>
        )}
      </div>
      {actions && <div className="mt-4 sm:mt-0 sm:ml-4">{actions}</div>}
    </div>
  );
}
