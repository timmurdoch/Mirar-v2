'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { FacilityMap } from '@/components/map/FacilityMap';
import { MapFilters } from '@/components/map/MapFilters';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import type { Facility, FilterConfig, Question, TooltipConfig } from '@/types/database';
import { List, Map, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ViewMode = 'map' | 'list';

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [tooltipConfig, setTooltipConfig] = useState<TooltipConfig[]>([]);
  const [filterConfig, setFilterConfig] = useState<FilterConfig[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [auditData, setAuditData] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch facilities
      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select('*')
        .eq('is_deleted', false)
        .order('venue_name');

      // Fetch configs
      const [tooltipRes, filterRes] = await Promise.all([
        supabase.from('tooltip_config').select('*').eq('is_active', true),
        supabase.from('filter_config').select('*').eq('is_active', true),
      ]);

      // Fetch published questionnaire with questions
      const { data: questionnaire } = await supabase
        .from('questionnaire_versions')
        .select(`
          id,
          sections (
            id,
            questions (*)
          )
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

      // Extract questions
      const allQuestions: Question[] = [];
      if (questionnaire?.sections) {
        questionnaire.sections.forEach((section: { questions: Question[] }) => {
          allQuestions.push(...section.questions);
        });
      }

      // Fetch latest audit data for each facility
      if (facilitiesData && facilitiesData.length > 0) {
        const facilityIds = facilitiesData.map((f) => f.id);
        const { data: audits } = await supabase
          .from('audits')
          .select(`
            id,
            facility_id,
            audit_answers (
              question_id,
              value
            )
          `)
          .in('facility_id', facilityIds)
          .order('created_at', { ascending: false });

        // Build audit data map (latest audit per facility)
        const auditDataMap: Record<string, Record<string, string>> = {};
        const seenFacilities = new Set<string>();

        audits?.forEach((audit) => {
          if (!seenFacilities.has(audit.facility_id)) {
            seenFacilities.add(audit.facility_id);
            auditDataMap[audit.facility_id] = {};

            audit.audit_answers.forEach((answer: { question_id: string; value: string }) => {
              const question = allQuestions.find((q) => q.id === answer.question_id);
              if (question) {
                auditDataMap[audit.facility_id][question.question_key] = answer.value;
              }
            });
          }
        });

        setAuditData(auditDataMap);
      }

      setFacilities(facilitiesData || []);
      setTooltipConfig(tooltipRes.data || []);
      setFilterConfig(filterRes.data || []);
      setQuestions(allQuestions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          facility.venue_name.toLowerCase().includes(query) ||
          facility.venue_address?.toLowerCase().includes(query) ||
          facility.town_suburb?.toLowerCase().includes(query) ||
          facility.state?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Apply configured filters
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;

        const [source, fieldKey] = key.split(':');

        if (source === 'facility') {
          const facilityRecord = facility as unknown as Record<string, unknown>;
          const facilityValue = facilityRecord[fieldKey];
          if (typeof facilityValue === 'string') {
            if (!facilityValue.toLowerCase().includes(value.toLowerCase())) {
              return false;
            }
          }
        } else if (source === 'question') {
          const auditValue = auditData[facility.id]?.[fieldKey];
          if (!auditValue || !auditValue.toLowerCase().includes(value.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }, [facilities, searchQuery, filters, auditData]);

  // Get unique values for filter dropdowns
  const facilityStates = useMemo(() => {
    const states = new Set<string>();
    facilities.forEach((f) => f.state && states.add(f.state));
    return Array.from(states).sort();
  }, [facilities]);

  const facilitySuburbs = useMemo(() => {
    const suburbs = new Set<string>();
    facilities.forEach((f) => f.town_suburb && suburbs.add(f.town_suburb));
    return Array.from(suburbs).sort();
  }, [facilities]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  return (
    <div className="h-[calc(100vh-8rem)]">
      <PageHeader
        title="Facilities"
        description={`${filteredFacilities.length} facilities`}
        actions={
          <Link href="/facilities/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {/* Search and view toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search facilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'map'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Map className="h-4 w-4" />
              Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
        </div>

        {/* Filters */}
        <MapFilters
          filterConfig={filterConfig}
          questions={questions}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          facilityStates={facilityStates}
          facilitySuburbs={facilitySuburbs}
        />

        {/* Content */}
        {loading ? (
          <div className="h-[500px] bg-white rounded-lg border border-gray-200 flex items-center justify-center">
            <div className="text-gray-500">Loading facilities...</div>
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-[500px] bg-white rounded-lg border border-gray-200 overflow-hidden">
            <FacilityMap
              facilities={filteredFacilities}
              tooltipConfig={tooltipConfig}
              auditData={auditData}
              onFacilityClick={(f) => setSelectedFacilityId(f.id)}
              selectedFacilityId={selectedFacilityId}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Venue Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Town/Suburb
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      State
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredFacilities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No facilities found
                      </td>
                    </tr>
                  ) : (
                    filteredFacilities.map((facility) => (
                      <tr key={facility.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <Link
                            href={`/facilities/${facility.id}`}
                            className="font-medium text-blue-600 hover:text-blue-700"
                          >
                            {facility.venue_name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {facility.venue_address || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {facility.town_suburb || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {facility.state || '-'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link href={`/facilities/${facility.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
