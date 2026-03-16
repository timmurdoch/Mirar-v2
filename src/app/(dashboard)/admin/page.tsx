'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Tabs, TabContent, TabList, TabTrigger } from '@/components/ui/Tabs';
import { createClient } from '@/lib/supabase/client';
import { canConfigureQuestionnaire } from '@/lib/utils';
import type { FilterConfig, Question, TooltipConfig } from '@/types/database';
import { Edit2, Plus, Trash2, GripVertical } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Facility fields available for tooltip/filter configuration
const FACILITY_FIELDS = [
  { value: 'venue_name', label: 'Venue Name' },
  { value: 'venue_address', label: 'Address' },
  { value: 'town_suburb', label: 'Town/Suburb' },
  { value: 'postcode', label: 'Postcode' },
  { value: 'state', label: 'State' },
];

const FILTER_TYPE_OPTIONS = [
  { value: 'text', label: 'Text search' },
  { value: 'select', label: 'Single select' },
  { value: 'multi-select', label: 'Multi-select' },
  { value: 'range', label: 'Range' },
];

const FIELD_SOURCE_OPTIONS = [
  { value: 'facility', label: 'Facility field' },
  { value: 'question', label: 'Questionnaire question' },
];

// --- Tooltip Config Section ---

interface TooltipFormData {
  field_source: 'facility' | 'question';
  field_key: string;
  display_label: string;
  sort_order: number;
  is_active: boolean;
}

const defaultTooltipForm: TooltipFormData = {
  field_source: 'facility',
  field_key: '',
  display_label: '',
  sort_order: 0,
  is_active: true,
};

function TooltipConfigTab({ questions }: { questions: Question[] }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [configs, setConfigs] = useState<TooltipConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TooltipConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TooltipFormData>(defaultTooltipForm);

  const fetchConfigs = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('tooltip_config')
        .select('*')
        .order('sort_order', { ascending: true })
        .abortSignal(AbortSignal.timeout(10_000));

      if (error) throw error;
      setConfigs(data || []);
    } catch (err) {
      console.error('Error fetching tooltip configs:', err);
      if (retryCount < 2) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchConfigs(retryCount + 1);
      }
      setFetchError('Failed to load tooltip configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const openCreateModal = () => {
    setEditingConfig(null);
    const nextOrder = configs.length > 0 ? Math.max(...configs.map((c) => c.sort_order)) + 1 : 1;
    setForm({ ...defaultTooltipForm, sort_order: nextOrder });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (config: TooltipConfig) => {
    setEditingConfig(config);
    setForm({
      field_source: config.field_source,
      field_key: config.field_key,
      display_label: config.display_label,
      sort_order: config.sort_order,
      is_active: config.is_active,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.field_key || !form.display_label) {
      setFormError('Field and display label are required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingConfig) {
        const { error } = await supabase
          .from('tooltip_config')
          .update({
            field_source: form.field_source,
            field_key: form.field_key,
            display_label: form.display_label,
            sort_order: form.sort_order,
            is_active: form.is_active,
          })
          .eq('id', editingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tooltip_config')
          .insert({
            field_source: form.field_source,
            field_key: form.field_key,
            display_label: form.display_label,
            sort_order: form.sort_order,
            is_active: form.is_active,
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingConfig(null);
      await fetchConfigs();
    } catch (err) {
      console.error('Error saving tooltip config:', err);
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tooltip_config')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;
      setDeletingId(null);
      await fetchConfigs();
    } catch (err) {
      console.error('Error deleting tooltip config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (config: TooltipConfig) => {
    try {
      const { error } = await supabase
        .from('tooltip_config')
        .update({ is_active: !config.is_active })
        .eq('id', config.id);

      if (error) throw error;
      await fetchConfigs();
    } catch (err) {
      console.error('Error toggling tooltip config:', err);
    }
  };

  const fieldKeyOptions = form.field_source === 'facility'
    ? FACILITY_FIELDS
    : questions.map((q) => ({ value: q.question_key, label: q.label }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Configure which fields appear in map marker popups when a user clicks on a facility.
        </p>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {fetchError && (
        <div className="mb-4">
          <ErrorAlert message={fetchError} onRetry={() => fetchConfigs()} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Display Label</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Field Key</TableHead>
                <TableHead>Sort Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : configs.length === 0 ? (
                <TableEmpty colSpan={7} message="No tooltip fields configured. Add one to get started." />
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-gray-300" />
                    </TableCell>
                    <TableCell className="font-medium">{config.display_label}</TableCell>
                    <TableCell>
                      <Badge variant="default" size="sm">
                        {config.field_source === 'facility' ? 'Facility' : 'Question'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 font-mono">{config.field_key}</TableCell>
                    <TableCell className="text-sm text-gray-600">{config.sort_order}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(config)}
                        className="cursor-pointer"
                      >
                        <Badge variant={config.is_active ? 'success' : 'default'} size="sm">
                          {config.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(config)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(config.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingConfig(null); }}
        title={editingConfig ? 'Edit Tooltip Field' : 'Add Tooltip Field'}
      >
        <div className="space-y-4">
          <Select
            label="Field Source"
            options={FIELD_SOURCE_OPTIONS}
            value={form.field_source}
            onChange={(e) => setForm({ ...form, field_source: e.target.value as 'facility' | 'question', field_key: '' })}
          />
          <Select
            label="Field"
            options={fieldKeyOptions}
            value={form.field_key}
            onChange={(e) => {
              const selected = fieldKeyOptions.find((o) => o.value === e.target.value);
              setForm({
                ...form,
                field_key: e.target.value,
                display_label: form.display_label || selected?.label || '',
              });
            }}
            placeholder="Select a field..."
          />
          <Input
            label="Display Label"
            value={form.display_label}
            onChange={(e) => setForm({ ...form, display_label: e.target.value })}
            helperText="The label shown in the tooltip"
          />
          <Input
            label="Sort Order"
            type="number"
            value={String(form.sort_order)}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingConfig ? 'Save Changes' : 'Add Field'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Remove Tooltip Field"
        message="Are you sure you want to remove this tooltip field?"
        confirmText="Remove"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}

// --- Filter Config Section ---

interface FilterFormData {
  field_source: 'facility' | 'question';
  field_key: string;
  display_label: string;
  filter_type: 'select' | 'multi-select' | 'range' | 'text';
  sort_order: number;
  is_active: boolean;
}

const defaultFilterForm: FilterFormData = {
  field_source: 'facility',
  field_key: '',
  display_label: '',
  filter_type: 'select',
  sort_order: 0,
  is_active: true,
};

function FilterConfigTab({ questions }: { questions: Question[] }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [configs, setConfigs] = useState<FilterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FilterConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FilterFormData>(defaultFilterForm);

  const fetchConfigs = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('filter_config')
        .select('*')
        .order('sort_order', { ascending: true })
        .abortSignal(AbortSignal.timeout(10_000));

      if (error) throw error;
      setConfigs(data || []);
    } catch (err) {
      console.error('Error fetching filter configs:', err);
      if (retryCount < 2) {
        const delay = 1000 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchConfigs(retryCount + 1);
      }
      setFetchError('Failed to load filter configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const openCreateModal = () => {
    setEditingConfig(null);
    const nextOrder = configs.length > 0 ? Math.max(...configs.map((c) => c.sort_order)) + 1 : 1;
    setForm({ ...defaultFilterForm, sort_order: nextOrder });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (config: FilterConfig) => {
    setEditingConfig(config);
    setForm({
      field_source: config.field_source,
      field_key: config.field_key,
      display_label: config.display_label,
      filter_type: config.filter_type,
      sort_order: config.sort_order,
      is_active: config.is_active,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.field_key || !form.display_label) {
      setFormError('Field and display label are required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingConfig) {
        const { error } = await supabase
          .from('filter_config')
          .update({
            field_source: form.field_source,
            field_key: form.field_key,
            display_label: form.display_label,
            filter_type: form.filter_type,
            sort_order: form.sort_order,
            is_active: form.is_active,
          })
          .eq('id', editingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('filter_config')
          .insert({
            field_source: form.field_source,
            field_key: form.field_key,
            display_label: form.display_label,
            filter_type: form.filter_type,
            sort_order: form.sort_order,
            is_active: form.is_active,
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingConfig(null);
      await fetchConfigs();
    } catch (err) {
      console.error('Error saving filter config:', err);
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('filter_config')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;
      setDeletingId(null);
      await fetchConfigs();
    } catch (err) {
      console.error('Error deleting filter config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (config: FilterConfig) => {
    try {
      const { error } = await supabase
        .from('filter_config')
        .update({ is_active: !config.is_active })
        .eq('id', config.id);

      if (error) throw error;
      await fetchConfigs();
    } catch (err) {
      console.error('Error toggling filter config:', err);
    }
  };

  const fieldKeyOptions = form.field_source === 'facility'
    ? FACILITY_FIELDS
    : questions.map((q) => ({ value: q.question_key, label: q.label }));

  const filterTypeLabel = (type: FilterConfig['filter_type']) => {
    return FILTER_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Configure which filters are available in the facilities view for narrowing down results.
        </p>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </div>

      {fetchError && (
        <div className="mb-4">
          <ErrorAlert message={fetchError} onRetry={() => fetchConfigs()} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Display Label</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Field Key</TableHead>
                <TableHead>Filter Type</TableHead>
                <TableHead>Sort Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : configs.length === 0 ? (
                <TableEmpty colSpan={8} message="No filters configured. Add one to get started." />
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-gray-300" />
                    </TableCell>
                    <TableCell className="font-medium">{config.display_label}</TableCell>
                    <TableCell>
                      <Badge variant="default" size="sm">
                        {config.field_source === 'facility' ? 'Facility' : 'Question'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 font-mono">{config.field_key}</TableCell>
                    <TableCell className="text-sm text-gray-600">{filterTypeLabel(config.filter_type)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{config.sort_order}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(config)}
                        className="cursor-pointer"
                      >
                        <Badge variant={config.is_active ? 'success' : 'default'} size="sm">
                          {config.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(config)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(config.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingConfig(null); }}
        title={editingConfig ? 'Edit Filter' : 'Add Filter'}
      >
        <div className="space-y-4">
          <Select
            label="Field Source"
            options={FIELD_SOURCE_OPTIONS}
            value={form.field_source}
            onChange={(e) => setForm({ ...form, field_source: e.target.value as 'facility' | 'question', field_key: '' })}
          />
          <Select
            label="Field"
            options={fieldKeyOptions}
            value={form.field_key}
            onChange={(e) => {
              const selected = fieldKeyOptions.find((o) => o.value === e.target.value);
              setForm({
                ...form,
                field_key: e.target.value,
                display_label: form.display_label || selected?.label || '',
              });
            }}
            placeholder="Select a field..."
          />
          <Input
            label="Display Label"
            value={form.display_label}
            onChange={(e) => setForm({ ...form, display_label: e.target.value })}
            helperText="The label shown above the filter control"
          />
          <Select
            label="Filter Type"
            options={FILTER_TYPE_OPTIONS}
            value={form.filter_type}
            onChange={(e) => setForm({ ...form, filter_type: e.target.value as FilterFormData['filter_type'] })}
          />
          <Input
            label="Sort Order"
            type="number"
            value={String(form.sort_order)}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingConfig ? 'Save Changes' : 'Add Filter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Remove Filter"
        message="Are you sure you want to remove this filter?"
        confirmText="Remove"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}

// --- Main Page ---

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [questions, setQuestions] = useState<Question[]>([]);

  // Guard: only admins and super_admins
  useEffect(() => {
    if (profile && !canConfigureQuestionnaire(profile.role)) {
      router.replace('/facilities');
    }
  }, [profile, router]);

  // Load questions from the published questionnaire so they can be used in field selectors
  useEffect(() => {
    async function loadQuestions() {
      const { data: questionnaire } = await supabase
        .from('questionnaire_versions')
        .select('id, sections(id, questions(*))')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .abortSignal(AbortSignal.timeout(10_000))
        .single();

      if (questionnaire?.sections) {
        const allQuestions: Question[] = [];
        (questionnaire.sections as { questions: Question[] }[]).forEach((section) => {
          allQuestions.push(...section.questions.filter((q) => !q.is_retired));
        });
        setQuestions(allQuestions);
      }
    }

    loadQuestions();
  }, [supabase]);

  if (!profile || !canConfigureQuestionnaire(profile.role)) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Admin Panel"
        description="Configure dashboard settings for all users"
      />

      <Tabs defaultTab="tooltips">
        <TabList>
          <TabTrigger value="tooltips">Tooltip Configuration</TabTrigger>
          <TabTrigger value="filters">Filter Configuration</TabTrigger>
        </TabList>

        <TabContent value="tooltips">
          <TooltipConfigTab questions={questions} />
        </TabContent>

        <TabContent value="filters">
          <FilterConfigTab questions={questions} />
        </TabContent>
      </Tabs>
    </div>
  );
}
