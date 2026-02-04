'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CheckboxGroup } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Select } from '@/components/ui/Select';
import { Tabs, TabContent, TabList, TabTrigger } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { createClient } from '@/lib/supabase/client';
import { AUSTRALIAN_STATES, canViewChangeLogs, formatDateTime, parseCheckboxValue, stringifyCheckboxValue } from '@/lib/utils';
import type { Audit, AuditAnswer, ChangeLog, Facility, Question, QuestionnaireVersion, Section } from '@/types/database';
import { ArrowLeft, Calendar, Edit2, History, MapPin, Save, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface SectionWithQuestions extends Section {
  questions: Question[];
}

interface QuestionnaireData extends QuestionnaireVersion {
  sections: SectionWithQuestions[];
}

interface AuditWithAnswers extends Audit {
  audit_answers: AuditAnswer[];
}

export default function FacilityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const facilityId = params.id as string;
  const supabase = createClient();
  const { profile } = useAuth();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [audits, setAudits] = useState<AuditWithAnswers[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [facilityForm, setFacilityForm] = useState<Partial<Facility>>({});
  const [auditAnswers, setAuditAnswers] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch facility
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', facilityId)
        .single();

      if (facilityError) throw facilityError;
      setFacility(facilityData);
      setFacilityForm(facilityData);

      // Fetch published questionnaire with sections and questions
      const { data: questionnaireData } = await supabase
        .from('questionnaire_versions')
        .select(`
          *,
          sections (
            *,
            questions (*)
          )
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();

      if (questionnaireData) {
        // Sort sections and questions
        const qData = questionnaireData as unknown as QuestionnaireData;
        qData.sections.sort((a, b) => a.sort_order - b.sort_order);
        qData.sections.forEach((section) => {
          section.questions.sort((a, b) => a.sort_order - b.sort_order);
        });
        setQuestionnaire(qData);
      }

      // Fetch audits for this facility
      const { data: auditsData } = await supabase
        .from('audits')
        .select(`
          *,
          audit_answers (*)
        `)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (auditsData) {
        const typedAudits = auditsData as unknown as AuditWithAnswers[];
        setAudits(typedAudits);
        // Select the latest audit by default
        if (typedAudits.length > 0) {
          setSelectedAuditId(typedAudits[0].id);
          // Build answers map
          const answers: Record<string, string> = {};
          typedAudits[0].audit_answers.forEach((a) => {
            answers[a.question_id] = a.value || '';
          });
          setAuditAnswers(answers);
        }
      }

      // Fetch change logs
      const { data: logsData } = await supabase
        .from('change_logs')
        .select('*')
        .eq('facility_id', facilityId)
        .order('changed_at', { ascending: false })
        .limit(100);

      setChangeLogs(logsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load facility data');
    } finally {
      setLoading(false);
    }
  }, [facilityId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle audit selection
  const handleAuditSelect = (auditId: string) => {
    setSelectedAuditId(auditId);
    const audit = audits.find((a) => a.id === auditId);
    if (audit) {
      const answers: Record<string, string> = {};
      audit.audit_answers.forEach((a) => {
        answers[a.question_id] = a.value || '';
      });
      setAuditAnswers(answers);
    }
  };

  // Handle form changes
  const handleFacilityChange = (field: string, value: string | number | null) => {
    setFacilityForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAuditAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      // Track changes for logging
      const facilityChanges: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      // Check facility changes
      if (facility) {
        const fieldsToCheck = ['venue_name', 'venue_address', 'town_suburb', 'postcode', 'state', 'latitude', 'longitude'];
        const facilityRecord = facility as unknown as Record<string, unknown>;
        const formRecord = facilityForm as unknown as Record<string, unknown>;
        fieldsToCheck.forEach((field) => {
          const oldVal = String(facilityRecord[field] ?? '');
          const newVal = String(formRecord[field] ?? '');
          if (oldVal !== newVal) {
            facilityChanges.push({ field, oldValue: oldVal || null, newValue: newVal || null });
          }
        });
      }

      // Update facility
      const { error: facilityError } = await supabase
        .from('facilities')
        .update({
          venue_name: facilityForm.venue_name,
          venue_address: facilityForm.venue_address || null,
          town_suburb: facilityForm.town_suburb || null,
          postcode: facilityForm.postcode || null,
          state: facilityForm.state || null,
          latitude: facilityForm.latitude ? Number(facilityForm.latitude) : null,
          longitude: facilityForm.longitude ? Number(facilityForm.longitude) : null,
        })
        .eq('id', facilityId);

      if (facilityError) throw facilityError;

      // Log facility changes
      for (const change of facilityChanges) {
        await supabase.from('change_logs').insert({
          facility_id: facilityId,
          entity_type: 'facility',
          field_name: change.field,
          old_value: change.oldValue,
          new_value: change.newValue,
          changed_by: userId,
        });
      }

      // Handle audit answers
      if (questionnaire) {
        let auditId = selectedAuditId;

        // Create new audit if none exists
        if (!auditId) {
          const { data: newAudit, error: auditError } = await supabase
            .from('audits')
            .insert({
              facility_id: facilityId,
              questionnaire_version_id: questionnaire.id,
              created_by: userId,
            })
            .select()
            .single();

          if (auditError) throw auditError;
          auditId = newAudit.id;
        }

        // Get existing answers for comparison
        const existingAudit = audits.find((a) => a.id === auditId);
        const existingAnswers: Record<string, string> = {};
        existingAudit?.audit_answers.forEach((a) => {
          existingAnswers[a.question_id] = a.value || '';
        });

        // Upsert answers and log changes
        for (const [questionId, value] of Object.entries(auditAnswers)) {
          const oldValue = existingAnswers[questionId] || '';
          if (oldValue !== value) {
            // Find question key for logging
            let questionKey = questionId;
            questionnaire.sections.forEach((section) => {
              const q = section.questions.find((q) => q.id === questionId);
              if (q) questionKey = q.question_key;
            });

            // Upsert answer
            await supabase
              .from('audit_answers')
              .upsert({
                audit_id: auditId,
                question_id: questionId,
                value: value || null,
              }, {
                onConflict: 'audit_id,question_id',
              });

            // Log change
            await supabase.from('change_logs').insert({
              facility_id: facilityId,
              audit_id: auditId,
              entity_type: 'audit_answer',
              field_name: questionKey,
              old_value: oldValue || null,
              new_value: value || null,
              changed_by: userId,
            });
          }
        }
      }

      setIsEditing(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setFacilityForm(facility || {});
    // Reset answers
    if (selectedAuditId) {
      const audit = audits.find((a) => a.id === selectedAuditId);
      if (audit) {
        const answers: Record<string, string> = {};
        audit.audit_answers.forEach((a) => {
          answers[a.question_id] = a.value || '';
        });
        setAuditAnswers(answers);
      }
    }
  };

  // Render question input based on type
  const renderQuestionInput = (question: Question) => {
    const value = auditAnswers[question.id] || '';
    const disabled = !isEditing || question.is_retired;

    switch (question.question_type) {
      case 'string':
        return (
          <Input
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={disabled}
            placeholder={question.description || ''}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={disabled}
            placeholder={question.description || ''}
          />
        );

      case 'list':
        return (
          <Select
            options={(question.options || []).map((opt) => ({ value: opt, label: opt }))}
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={disabled}
            placeholder="Select..."
          />
        );

      case 'radio':
        return (
          <RadioGroup
            name={question.id}
            options={(question.options || []).map((opt) => ({ value: opt, label: opt }))}
            value={value}
            onChange={(val) => handleAnswerChange(question.id, val)}
            disabled={disabled}
          />
        );

      case 'checkbox':
        return (
          <CheckboxGroup
            options={(question.options || []).map((opt) => ({ value: opt, label: opt }))}
            value={parseCheckboxValue(value)}
            onChange={(vals) => handleAnswerChange(question.id, stringifyCheckboxValue(vals))}
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading facility...</p>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 mb-4">Facility not found</p>
        <Link href="/facilities">
          <Button variant="secondary">Back to Facilities</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/facilities"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Facilities
        </Link>
        <PageHeader
          title={facility.venue_name}
          description={
            <span className="flex items-center gap-1 text-gray-500">
              <MapPin className="h-4 w-4" />
              {[facility.venue_address, facility.town_suburb, facility.state]
                .filter(Boolean)
                .join(', ') || 'No address'}
            </span>
          }
          actions={
            isEditing ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} loading={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )
          }
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Tabs defaultTab="details">
        <TabList>
          <TabTrigger value="details">Facility Details</TabTrigger>
          <TabTrigger value="audit">Audit Data</TabTrigger>
          {profile && canViewChangeLogs(profile.role) && (
            <TabTrigger value="history">Change History</TabTrigger>
          )}
        </TabList>

        {/* Facility Details Tab */}
        <TabContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Baseline Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input
                    label="Venue Name"
                    value={facilityForm.venue_name || ''}
                    onChange={(e) => handleFacilityChange('venue_name', e.target.value)}
                    disabled={!isEditing}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Address"
                    value={facilityForm.venue_address || ''}
                    onChange={(e) => handleFacilityChange('venue_address', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                <Input
                  label="Town/Suburb"
                  value={facilityForm.town_suburb || ''}
                  onChange={(e) => handleFacilityChange('town_suburb', e.target.value)}
                  disabled={!isEditing}
                />

                <Input
                  label="Postcode"
                  value={facilityForm.postcode || ''}
                  onChange={(e) => handleFacilityChange('postcode', e.target.value)}
                  disabled={!isEditing}
                />

                <Select
                  label="State"
                  options={AUSTRALIAN_STATES}
                  value={facilityForm.state || ''}
                  onChange={(e) => handleFacilityChange('state', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Select state"
                />

                <div />

                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  value={facilityForm.latitude?.toString() || ''}
                  onChange={(e) => handleFacilityChange('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                  disabled={!isEditing}
                />

                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  value={facilityForm.longitude?.toString() || ''}
                  onChange={(e) => handleFacilityChange('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                  disabled={!isEditing}
                />
              </div>

              <div className="mt-6 pt-6 border-t text-sm text-gray-500">
                <p>Facility ID: {facility.id}</p>
                <p>Created: {formatDateTime(facility.created_at)}</p>
                <p>Last Updated: {formatDateTime(facility.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </TabContent>

        {/* Audit Data Tab */}
        <TabContent value="audit">
          {/* Audit selector */}
          {audits.length > 0 && (
            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <History className="h-4 w-4" />
                <span>Audit History:</span>
              </div>
              <Select
                options={audits.map((a) => ({
                  value: a.id,
                  label: `${formatDateTime(a.created_at)} (${a.questionnaire_version_id.slice(0, 8)})`,
                }))}
                value={selectedAuditId || ''}
                onChange={(e) => handleAuditSelect(e.target.value)}
                className="max-w-xs"
              />
            </div>
          )}

          {questionnaire ? (
            <div className="space-y-6">
              {questionnaire.sections.map((section) => (
                <Card key={section.id}>
                  <CardHeader>
                    <CardTitle>{section.name}</CardTitle>
                    {section.description && (
                      <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {section.questions
                        .filter((q) => !q.is_retired || auditAnswers[q.id])
                        .map((question) => (
                          <div key={question.id}>
                            <div className="flex items-start gap-2 mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                {question.label}
                                {question.is_required && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              {question.is_retired && (
                                <Badge variant="warning" size="sm">Retired</Badge>
                              )}
                            </div>
                            {question.description && (
                              <p className="text-xs text-gray-500 mb-2">{question.description}</p>
                            )}
                            {renderQuestionInput(question)}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No published questionnaire available.</p>
                <p className="text-sm text-gray-400 mt-1">
                  An admin needs to publish a questionnaire version first.
                </p>
              </CardContent>
            </Card>
          )}
        </TabContent>

        {/* Change History Tab */}
        {profile && canViewChangeLogs(profile.role) && (
          <TabContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Change Log</CardTitle>
              </CardHeader>
              <CardContent>
                {changeLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No changes recorded</p>
                ) : (
                  <div className="space-y-4">
                    {changeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {log.field_name === '_created' ? 'Facility created' : `Changed ${log.field_name}`}
                          </p>
                          {log.field_name !== '_created' && (
                            <p className="text-sm text-gray-500 mt-1">
                              <span className="line-through text-gray-400">
                                {log.old_value || '(empty)'}
                              </span>
                              {' → '}
                              <span>{log.new_value || '(empty)'}</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDateTime(log.changed_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabContent>
        )}
      </Tabs>
    </div>
  );
}
