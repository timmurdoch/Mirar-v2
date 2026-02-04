'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { FilterConfig, Question } from '@/types/database';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { useState } from 'react';

interface MapFiltersProps {
  filterConfig: FilterConfig[];
  questions: Question[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  facilityStates: string[];
  facilitySuburbs: string[];
}

export function MapFilters({
  filterConfig,
  questions,
  filters,
  onFilterChange,
  onClearFilters,
  facilityStates,
  facilitySuburbs,
}: MapFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilters = filterConfig.filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const activeFilterCount = Object.values(filters).filter((v) => v).length;

  const getFilterOptions = (config: FilterConfig) => {
    if (config.field_source === 'facility') {
      if (config.field_key === 'state') {
        return facilityStates.map((s) => ({ value: s, label: s }));
      }
      if (config.field_key === 'town_suburb') {
        return facilitySuburbs.map((s) => ({ value: s, label: s }));
      }
    }

    if (config.field_source === 'question') {
      const question = questions.find((q) => q.question_key === config.field_key);
      if (question?.options) {
        return question.options.map((opt) => ({ value: opt, label: opt }));
      }
    }

    return [];
  };

  const renderFilter = (config: FilterConfig) => {
    const key = `${config.field_source}:${config.field_key}`;
    const value = filters[key] || '';

    if (config.filter_type === 'text') {
      return (
        <Input
          key={config.id}
          placeholder={config.display_label}
          value={value}
          onChange={(e) => onFilterChange(key, e.target.value)}
          className="h-9"
        />
      );
    }

    const options = getFilterOptions(config);
    return (
      <Select
        key={config.id}
        options={options}
        value={value}
        onChange={(e) => onFilterChange(key, e.target.value)}
        placeholder={config.display_label}
        className="h-9"
      />
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Filter header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Filter content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {activeFilters.map(renderFilter)}
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-gray-500"
              >
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
