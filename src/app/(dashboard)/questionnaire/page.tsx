'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime, generateQuestionKey } from '@/lib/utils';
import type { Question, QuestionnaireVersion, QuestionType, Section } from '@/types/database';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  GripVertical,
  Plus,
  Send,
  Trash2,
  Archive,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SectionWithQuestions extends Section {
  questions: Question[];
}

interface QuestionnaireData extends QuestionnaireVersion {
  sections: SectionWithQuestions[];
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'list', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkboxes (Multi-select)' },
];

export default function QuestionnairePage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [versions, setVersions] = useState<QuestionnaireVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<QuestionnaireData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);

  // Form state
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: '', description: '' });
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    label: '',
    description: '',
    question_type: 'string' as QuestionType,
    options: '',
    is_required: false,
  });
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [retiringQuestionId, setRetiringQuestionId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    const { data } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .order('version_number', { ascending: false });

    setVersions(data || []);
    return data || [];
  }, [supabase]);

  const fetchVersionDetails = useCallback(async (versionId: string) => {
    const { data } = await supabase
      .from('questionnaire_versions')
      .select(`
        *,
        sections (
          *,
          questions (*)
        )
      `)
      .eq('id', versionId)
      .single();

    if (data) {
      data.sections.sort((a: Section, b: Section) => a.sort_order - b.sort_order);
      data.sections.forEach((section: SectionWithQuestions) => {
        section.questions.sort((a, b) => a.sort_order - b.sort_order);
      });
      setSelectedVersion(data as QuestionnaireData);
    }
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const versionList = await fetchVersions();
      if (versionList.length > 0) {
        await fetchVersionDetails(versionList[0].id);
      }
      setLoading(false);
    };
    init();
  }, [fetchVersions, fetchVersionDetails]);

  // Create new version
  const handleCreateVersion = async () => {
    if (!newVersionName.trim()) return;

    setSaving(true);
    try {
      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('questionnaire_versions')
        .insert({
          version_number: nextVersion,
          name: newVersionName.trim(),
          description: newVersionDescription.trim() || null,
          status: 'draft',
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setShowNewVersionModal(false);
      setNewVersionName('');
      setNewVersionDescription('');
      await fetchVersions();
      await fetchVersionDetails(data.id);
    } catch (error) {
      console.error('Error creating version:', error);
    } finally {
      setSaving(false);
    }
  };

  // Publish version
  const handlePublish = async () => {
    if (!selectedVersion) return;

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Archive any currently published version
      await supabase
        .from('questionnaire_versions')
        .update({ status: 'archived' })
        .eq('status', 'published');

      // Publish selected version
      await supabase
        .from('questionnaire_versions')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user.user?.id,
        })
        .eq('id', selectedVersion.id);

      setShowPublishConfirm(false);
      await fetchVersions();
      await fetchVersionDetails(selectedVersion.id);
    } catch (error) {
      console.error('Error publishing:', error);
    } finally {
      setSaving(false);
    }
  };

  // Create/update section
  const handleSaveSection = async () => {
    if (!selectedVersion || !sectionForm.name.trim()) return;

    setSaving(true);
    try {
      if (editingSection) {
        await supabase
          .from('sections')
          .update({
            name: sectionForm.name.trim(),
            description: sectionForm.description.trim() || null,
          })
          .eq('id', editingSection.id);
      } else {
        const nextOrder = selectedVersion.sections.length;
        await supabase
          .from('sections')
          .insert({
            questionnaire_version_id: selectedVersion.id,
            name: sectionForm.name.trim(),
            description: sectionForm.description.trim() || null,
            sort_order: nextOrder,
          });
      }

      setShowSectionModal(false);
      setEditingSection(null);
      setSectionForm({ name: '', description: '' });
      await fetchVersionDetails(selectedVersion.id);
    } catch (error) {
      console.error('Error saving section:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: string) => {
    if (!selectedVersion || !confirm('Delete this section and all its questions?')) return;

    try {
      await supabase.from('sections').delete().eq('id', sectionId);
      await fetchVersionDetails(selectedVersion.id);
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  };

  // Create/update question
  const handleSaveQuestion = async () => {
    if (!selectedVersion || !selectedSectionId || !questionForm.label.trim()) return;

    setSaving(true);
    try {
      const options = ['list', 'radio', 'checkbox'].includes(questionForm.question_type)
        ? questionForm.options.split('\n').map(o => o.trim()).filter(Boolean)
        : null;

      if (editingQuestion) {
        await supabase
          .from('questions')
          .update({
            label: questionForm.label.trim(),
            description: questionForm.description.trim() || null,
            question_type: questionForm.question_type,
            options,
            is_required: questionForm.is_required,
          })
          .eq('id', editingQuestion.id);
      } else {
        const section = selectedVersion.sections.find(s => s.id === selectedSectionId);
        const nextOrder = section?.questions.length || 0;

        await supabase
          .from('questions')
          .insert({
            section_id: selectedSectionId,
            question_key: generateQuestionKey(questionForm.label),
            label: questionForm.label.trim(),
            description: questionForm.description.trim() || null,
            question_type: questionForm.question_type,
            options,
            is_required: questionForm.is_required,
            sort_order: nextOrder,
          });
      }

      setShowQuestionModal(false);
      setEditingQuestion(null);
      setQuestionForm({
        label: '',
        description: '',
        question_type: 'string',
        options: '',
        is_required: false,
      });
      await fetchVersionDetails(selectedVersion.id);
    } catch (error) {
      console.error('Error saving question:', error);
    } finally {
      setSaving(false);
    }
  };

  // Retire question
  const handleRetireQuestion = async () => {
    if (!retiringQuestionId || !selectedVersion) return;

    setSaving(true);
    try {
      await supabase
        .from('questions')
        .update({
          is_retired: true,
          retired_at: new Date().toISOString(),
        })
        .eq('id', retiringQuestionId);

      setShowRetireConfirm(false);
      setRetiringQuestionId(null);
      await fetchVersionDetails(selectedVersion.id);
    } catch (error) {
      console.error('Error retiring question:', error);
    } finally {
      setSaving(false);
    }
  };

  // Move section up/down
  const handleMoveSection = async (sectionId: string, direction: 'up' | 'down') => {
    if (!selectedVersion) return;

    const sections = [...selectedVersion.sections];
    const index = sections.findIndex(s => s.id === sectionId);
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= sections.length) return;

    // Swap sort orders
    const temp = sections[index].sort_order;
    sections[index].sort_order = sections[newIndex].sort_order;
    sections[newIndex].sort_order = temp;

    try {
      await Promise.all([
        supabase.from('sections').update({ sort_order: sections[index].sort_order }).eq('id', sections[index].id),
        supabase.from('sections').update({ sort_order: sections[newIndex].sort_order }).eq('id', sections[newIndex].id),
      ]);
      await fetchVersionDetails(selectedVersion.id);
    } catch (error) {
      console.error('Error moving section:', error);
    }
  };

  const openEditSection = (section: Section) => {
    setEditingSection(section);
    setSectionForm({ name: section.name, description: section.description || '' });
    setShowSectionModal(true);
  };

  const openAddQuestion = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setEditingQuestion(null);
    setQuestionForm({
      label: '',
      description: '',
      question_type: 'string',
      options: '',
      is_required: false,
    });
    setShowQuestionModal(true);
  };

  const openEditQuestion = (question: Question, sectionId: string) => {
    setSelectedSectionId(sectionId);
    setEditingQuestion(question);
    setQuestionForm({
      label: question.label,
      description: question.description || '',
      question_type: question.question_type,
      options: question.options?.join('\n') || '',
      is_required: question.is_required,
    });
    setShowQuestionModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading questionnaire...</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Questionnaire Builder"
        description="Configure audit questionnaire versions"
        actions={
          <Button onClick={() => setShowNewVersionModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Version
          </Button>
        }
      />

      {/* Version selector */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {versions.map((version) => (
            <button
              key={version.id}
              onClick={() => fetchVersionDetails(version.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                selectedVersion?.id === version.id
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              v{version.version_number}: {version.name}
              <Badge
                variant={
                  version.status === 'published'
                    ? 'success'
                    : version.status === 'draft'
                    ? 'info'
                    : 'default'
                }
                size="sm"
                className="ml-2"
              >
                {version.status}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {selectedVersion ? (
        <>
          {/* Version details */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>v{selectedVersion.version_number}: {selectedVersion.name}</CardTitle>
                {selectedVersion.description && (
                  <p className="text-sm text-gray-500 mt-1">{selectedVersion.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Created: {formatDateTime(selectedVersion.created_at)}
                  {selectedVersion.published_at && ` | Published: ${formatDateTime(selectedVersion.published_at)}`}
                </p>
              </div>
              {selectedVersion.status === 'draft' && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingSection(null);
                      setSectionForm({ name: '', description: '' });
                      setShowSectionModal(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Section
                  </Button>
                  <Button onClick={() => setShowPublishConfirm(true)}>
                    <Send className="h-4 w-4 mr-2" />
                    Publish
                  </Button>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Sections */}
          {selectedVersion.sections.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No sections yet. Add a section to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {selectedVersion.sections.map((section, sectionIndex) => (
                <Card key={section.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex items-start gap-3">
                      {selectedVersion.status === 'draft' && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveSection(section.id, 'up')}
                            disabled={sectionIndex === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleMoveSection(section.id, 'down')}
                            disabled={sectionIndex === selectedVersion.sections.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{section.name}</CardTitle>
                        {section.description && (
                          <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                        )}
                      </div>
                    </div>
                    {selectedVersion.status === 'draft' && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditSection(section)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteSection(section.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {section.questions.length === 0 ? (
                      <p className="text-gray-500 text-sm">No questions in this section.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.questions.map((question) => (
                            <TableRow key={question.id}>
                              <TableCell>
                                <GripVertical className="h-4 w-4 text-gray-400" />
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">{question.label}</span>
                                {question.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{question.description}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                  {question.question_key}
                                </code>
                              </TableCell>
                              <TableCell className="capitalize">{question.question_type}</TableCell>
                              <TableCell>{question.is_required ? 'Yes' : 'No'}</TableCell>
                              <TableCell>
                                {question.is_retired ? (
                                  <Badge variant="warning" size="sm">Retired</Badge>
                                ) : (
                                  <Badge variant="success" size="sm">Active</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {selectedVersion.status === 'draft' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditQuestion(question, section.id)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {!question.is_retired && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setRetiringQuestionId(question.id);
                                        setShowRetireConfirm(true);
                                      }}
                                    >
                                      <Archive className="h-3 w-3 text-yellow-500" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {selectedVersion.status === 'draft' && (
                      <div className="mt-4">
                        <Button variant="outline" size="sm" onClick={() => openAddQuestion(section.id)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Question
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">
              No questionnaire versions yet. Create your first version to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* New Version Modal */}
      <Modal
        isOpen={showNewVersionModal}
        onClose={() => setShowNewVersionModal(false)}
        title="Create New Version"
      >
        <div className="space-y-4">
          <Input
            label="Version Name"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            placeholder="e.g., Q2 2024 Audit"
            required
          />
          <Textarea
            label="Description"
            value={newVersionDescription}
            onChange={(e) => setNewVersionDescription(e.target.value)}
            placeholder="Describe the changes in this version..."
            rows={3}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNewVersionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateVersion} loading={saving}>
              Create Version
            </Button>
          </div>
        </div>
      </Modal>

      {/* Section Modal */}
      <Modal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        title={editingSection ? 'Edit Section' : 'Add Section'}
      >
        <div className="space-y-4">
          <Input
            label="Section Name"
            value={sectionForm.name}
            onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
            placeholder="e.g., Facility Condition"
            required
          />
          <Textarea
            label="Description"
            value={sectionForm.description}
            onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
            placeholder="Describe this section..."
            rows={2}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowSectionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection} loading={saving}>
              {editingSection ? 'Save Changes' : 'Add Section'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Question Modal */}
      <Modal
        isOpen={showQuestionModal}
        onClose={() => setShowQuestionModal(false)}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Question Label"
            value={questionForm.label}
            onChange={(e) => setQuestionForm({ ...questionForm, label: e.target.value })}
            placeholder="e.g., Overall Condition"
            required
          />
          <Textarea
            label="Description / Help Text"
            value={questionForm.description}
            onChange={(e) => setQuestionForm({ ...questionForm, description: e.target.value })}
            placeholder="Additional guidance for auditors..."
            rows={2}
          />
          <Select
            label="Question Type"
            options={QUESTION_TYPES}
            value={questionForm.question_type}
            onChange={(e) => setQuestionForm({ ...questionForm, question_type: e.target.value as QuestionType })}
          />
          {['list', 'radio', 'checkbox'].includes(questionForm.question_type) && (
            <Textarea
              label="Options (one per line)"
              value={questionForm.options}
              onChange={(e) => setQuestionForm({ ...questionForm, options: e.target.value })}
              placeholder="Option 1&#10;Option 2&#10;Option 3"
              rows={4}
              required
            />
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_required"
              checked={questionForm.is_required}
              onChange={(e) => setQuestionForm({ ...questionForm, is_required: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_required" className="text-sm text-gray-700">
              This question is required
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowQuestionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} loading={saving}>
              {editingQuestion ? 'Save Changes' : 'Add Question'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Publish Confirmation */}
      <ConfirmModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={handlePublish}
        title="Publish Questionnaire"
        message="Publishing this version will make it active for all audits. Any previously published version will be archived. Are you sure?"
        confirmText="Publish"
        loading={saving}
      />

      {/* Retire Confirmation */}
      <ConfirmModal
        isOpen={showRetireConfirm}
        onClose={() => setShowRetireConfirm(false)}
        onConfirm={handleRetireQuestion}
        title="Retire Question"
        message="Retiring this question will hide it from new audits, but historical data will be preserved. This cannot be undone."
        confirmText="Retire"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
