'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const checkboxId = id || props.name;

    return (
      <div className="relative flex items-start">
        <div className="flex h-6 items-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer',
              'peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2',
              'peer-checked:bg-blue-600 peer-checked:border-blue-600',
              error ? 'border-red-300' : 'border-gray-300',
              'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
              className
            )}
            onClick={() => {
              const input = document.getElementById(checkboxId!) as HTMLInputElement;
              input?.click();
            }}
          >
            <Check className="h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" />
          </div>
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="ml-3 text-sm text-gray-700 cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// Checkbox group for multi-select
export interface CheckboxGroupProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  error,
  required,
  disabled,
}: CheckboxGroupProps) {
  const handleChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((v) => v !== optionValue));
    }
  };

  return (
    <div className="w-full">
      {label && (
        <span className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <div key={option.value} className="flex items-center">
            <input
              type="checkbox"
              id={`checkbox-${option.value}`}
              checked={value.includes(option.value)}
              onChange={(e) => handleChange(option.value, e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <label
              htmlFor={`checkbox-${option.value}`}
              className="ml-3 text-sm text-gray-700 cursor-pointer"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export { Checkbox };
