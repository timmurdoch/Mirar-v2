'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { createClient } from '@/lib/supabase/client';
import type { Question, QuestionnaireVersion, Section } from '@/types/database';
import { Download, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface QuestionnaireData extends QuestionnaireVersion {
  sections: (Section & { questions: Question[] })[];
}

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export default function ImportExportPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questionnaires, setQuestionnaires] = useState<QuestionnaireData[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fetchQuestionnaires = useCallback(async () => {
    const { data } = await supabase
      .from('questionnaire_versions')
      .select(`
        *,
        sections (
          *,
          questions (*)
        )
      `)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (data) {
      setQuestionnaires(data as QuestionnaireData[]);
      if (data.length > 0) {
        setSelectedQuestionnaireId(data[0].id);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  const selectedQuestionnaire = questionnaires.find((q) => q.id === selectedQuestionnaireId);

  // Get all questions from selected questionnaire
  const getQuestions = () => {
    if (!selectedQuestionnaire) return [];
    const questions: Question[] = [];
    selectedQuestionnaire.sections.forEach((section) => {
      questions.push(...section.questions.filter((q) => !q.is_retired));
    });
    return questions;
  };

  // Export facility template
  const exportFacilityTemplate = () => {
    const headers = [
      'facility_id',
      'venue_name',
      'venue_address',
      'town_suburb',
      'postcode',
      'state',
      'latitude',
      'longitude',
    ];

    const csv = Papa.unparse({
      fields: headers,
      data: [],
    });

    downloadCsv(csv, 'facility_template.csv');
  };

  // Export audit template
  const exportAuditTemplate = () => {
    const questions = getQuestions();
    const headers = [
      'facility_id',
      'venue_name',
      'venue_address',
      'town_suburb',
      'postcode',
      'state',
      'latitude',
      'longitude',
      ...questions.map((q) => `q__${q.question_key}`),
    ];

    const csv = Papa.unparse({
      fields: headers,
      data: [],
    });

    downloadCsv(csv, `audit_template_v${selectedQuestionnaire?.version_number}.csv`);
  };

  // Export all facilities with audit data
  const exportFacilitiesWithAudits = async () => {
    setLoading(true);
    try {
      const questions = getQuestions();

      // Fetch all facilities
      const { data: facilities } = await supabase
        .from('facilities')
        .select('*')
        .eq('is_deleted', false);

      if (!facilities) {
        setLoading(false);
        return;
      }

      // Fetch latest audits for each facility
      const { data: audits } = await supabase
        .from('audits')
        .select(`
          *,
          audit_answers (*)
        `)
        .eq('questionnaire_version_id', selectedQuestionnaireId)
        .order('created_at', { ascending: false });

      // Build audit data map (latest per facility)
      const auditMap: Record<string, Record<string, string>> = {};
      const seenFacilities = new Set<string>();

      audits?.forEach((audit) => {
        if (!seenFacilities.has(audit.facility_id)) {
          seenFacilities.add(audit.facility_id);
          auditMap[audit.facility_id] = {};
          audit.audit_answers.forEach((answer: { question_id: string; value: string }) => {
            const question = questions.find((q) => q.id === answer.question_id);
            if (question) {
              auditMap[audit.facility_id][question.question_key] = answer.value || '';
            }
          });
        }
      });

      // Build export data
      const headers = [
        'facility_id',
        'venue_name',
        'venue_address',
        'town_suburb',
        'postcode',
        'state',
        'latitude',
        'longitude',
        ...questions.map((q) => `q__${q.question_key}`),
      ];

      const data = facilities.map((facility) => {
        const row: Record<string, string | number | null> = {
          facility_id: facility.id,
          venue_name: facility.venue_name,
          venue_address: facility.venue_address,
          town_suburb: facility.town_suburb,
          postcode: facility.postcode,
          state: facility.state,
          latitude: facility.latitude,
          longitude: facility.longitude,
        };

        questions.forEach((q) => {
          row[`q__${q.question_key}`] = auditMap[facility.id]?.[q.question_key] || '';
        });

        return row;
      });

      const csv = Papa.unparse({
        fields: headers,
        data,
      });

      downloadCsv(csv, `facilities_export_v${selectedQuestionnaire?.version_number}.csv`);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Import CSV
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });

      const questions = getQuestions();
      const result: ImportResult = { created: 0, updated: 0, errors: [] };
      const { data: user } = await supabase.auth.getUser();

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        const rowNum = i + 2;

        try {
          // Validate required fields
          if (!row.venue_name?.trim()) {
            result.errors.push({ row: rowNum, message: 'venue_name is required' });
            continue;
          }

          let facilityId = row.facility_id?.trim();
          const isNew = !facilityId;

          if (isNew) {
            // Create new facility
            facilityId = uuidv4();
            const { error } = await supabase
              .from('facilities')
              .insert({
                id: facilityId,
                venue_name: row.venue_name.trim(),
                venue_address: row.venue_address?.trim() || null,
                town_suburb: row.town_suburb?.trim() || null,
                postcode: row.postcode?.trim() || null,
                state: row.state?.trim() || null,
                latitude: row.latitude ? parseFloat(row.latitude) : null,
                longitude: row.longitude ? parseFloat(row.longitude) : null,
                created_by: user.user?.id,
              });

            if (error) {
              result.errors.push({ row: rowNum, message: error.message });
              continue;
            }
            result.created++;
          } else {
            // Update existing facility
            const { error } = await supabase
              .from('facilities')
              .update({
                venue_name: row.venue_name.trim(),
                venue_address: row.venue_address?.trim() || null,
                town_suburb: row.town_suburb?.trim() || null,
                postcode: row.postcode?.trim() || null,
                state: row.state?.trim() || null,
                latitude: row.latitude ? parseFloat(row.latitude) : null,
                longitude: row.longitude ? parseFloat(row.longitude) : null,
              })
              .eq('id', facilityId);

            if (error) {
              result.errors.push({ row: rowNum, message: error.message });
              continue;
            }
            result.updated++;
          }

          // Handle audit answers if questionnaire is selected
          if (selectedQuestionnaireId) {
            const hasAuditData = Object.keys(row).some((k) => k.startsWith('q__'));

            if (hasAuditData) {
              // Create or get audit
              let auditId: string;

              const { data: existingAudit } = await supabase
                .from('audits')
                .select('id')
                .eq('facility_id', facilityId)
                .eq('questionnaire_version_id', selectedQuestionnaireId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (existingAudit) {
                auditId = existingAudit.id;
              } else {
                const { data: newAudit, error: auditError } = await supabase
                  .from('audits')
                  .insert({
                    facility_id: facilityId,
                    questionnaire_version_id: selectedQuestionnaireId,
                    created_by: user.user?.id,
                  })
                  .select()
                  .single();

                if (auditError) {
                  result.errors.push({ row: rowNum, message: `Audit error: ${auditError.message}` });
                  continue;
                }
                auditId = newAudit.id;
              }

              // Upsert answers
              for (const [key, value] of Object.entries(row)) {
                if (!key.startsWith('q__')) continue;

                const questionKey = key.replace('q__', '');
                const question = questions.find((q) => q.question_key === questionKey);

                if (question && value !== undefined && value !== '') {
                  await supabase
                    .from('audit_answers')
                    .upsert({
                      audit_id: auditId,
                      question_id: question.id,
                      value: value.trim(),
                    }, {
                      onConflict: 'audit_id,question_id',
                    });
                }
              }
            }
          }
        } catch (error) {
          result.errors.push({ row: rowNum, message: 'Unexpected error' });
        }
      }

      setImportResult(result);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({ created: 0, updated: 0, errors: [{ row: 0, message: 'Failed to parse CSV' }] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Download errors as CSV
  const downloadErrorReport = () => {
    if (!importResult?.errors.length) return;

    const csv = Papa.unparse({
      fields: ['row', 'error'],
      data: importResult.errors.map((e) => ({ row: e.row, error: e.message })),
    });

    downloadCsv(csv, 'import_errors.csv');
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Import / Export"
        description="Download templates and bulk import facility data"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download templates or export existing data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Questionnaire selector */}
            {questionnaires.length > 0 && (
              <Select
                label="Questionnaire Version"
                options={questionnaires.map((q) => ({
                  value: q.id,
                  label: `v${q.version_number}: ${q.name}`,
                }))}
                value={selectedQuestionnaireId}
                onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
              />
            )}

            <div className="space-y-3">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Facility Template</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Baseline facility fields only (no audit questions)
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportFacilityTemplate}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              {selectedQuestionnaire && (
                <>
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Audit Template</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Facility fields + questionnaire v{selectedQuestionnaire.version_number} questions
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={exportAuditTemplate}>
                        <FileText className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Full Export</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          All facilities with latest audit data for v{selectedQuestionnaire.version_number}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={exportFacilitiesWithAudits} disabled={loading}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Upload CSV to create or update facilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Import Rules</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>If <code className="bg-blue-100 px-1 rounded">facility_id</code> is blank, a new facility is created</li>
                <li>If <code className="bg-blue-100 px-1 rounded">facility_id</code> exists, the facility is updated</li>
                <li>Audit answers are matched by question key columns (q__*)</li>
                <li><code className="bg-blue-100 px-1 rounded">venue_name</code> is required for all rows</li>
              </ul>
            </div>

            {questionnaires.length > 0 && (
              <Select
                label="Target Questionnaire Version"
                options={questionnaires.map((q) => ({
                  value: q.id,
                  label: `v${q.version_number}: ${q.name}`,
                }))}
                value={selectedQuestionnaireId}
                onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                helperText="Audit answers will be saved for this version"
              />
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                disabled={importing}
              />
              <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                loading={importing}
              >
                Select CSV File
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                Or drag and drop a CSV file
              </p>
            </div>

            {/* Import Results */}
            {importResult && (
              <div
                className={`p-4 rounded-lg ${
                  importResult.errors.length > 0
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {importResult.errors.length > 0 ? (
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Import Complete</h4>
                    <div className="flex gap-4 mt-2">
                      <Badge variant="success" size="sm">
                        {importResult.created} created
                      </Badge>
                      <Badge variant="info" size="sm">
                        {importResult.updated} updated
                      </Badge>
                      {importResult.errors.length > 0 && (
                        <Badge variant="danger" size="sm">
                          {importResult.errors.length} errors
                        </Badge>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Error Report
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
