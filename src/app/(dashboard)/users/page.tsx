'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { createClient } from '@/lib/supabase/client';
import { canManageAllUsers, formatDateTime } from '@/lib/utils';
import type { Profile, UserRole } from '@/types/database';
import { Plus, Upload, Trash2, Edit2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';

const ROLE_OPTIONS = [
  { value: 'auditor', label: 'Auditor' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

export default function UsersPage() {
  const { profile: currentProfile } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Form state
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'auditor' as UserRole,
  });
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkResults, setBulkResults] = useState<{ success: number; errors: string[] } | null>(null);

  const isSuperAdmin = currentProfile && canManageAllUsers(currentProfile.role);
  const roleOptions = isSuperAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((r) => r.value === 'auditor');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Create user
  const handleCreateUser = async () => {
    if (!userForm.email || !userForm.password) {
      setError('Email and password are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Create auth user via API route
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to create user');
        return;
      }

      setShowCreateModal(false);
      setUserForm({ email: '', password: '', full_name: '', role: 'auditor' });
      await fetchUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Update user
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: userForm.full_name || null,
          role: userForm.role,
        })
        .eq('id', editingUser.id);

      if (updateError) throw updateError;

      setShowEditModal(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error updating user:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deletingUserId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${deletingUserId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        console.error('Error deleting user:', result.error);
      }

      setShowDeleteConfirm(false);
      setDeletingUserId(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    } finally {
      setSaving(false);
    }
  };

  // Bulk import
  const handleBulkImport = async () => {
    if (!bulkCsv.trim()) return;

    setSaving(true);
    setBulkResults(null);

    try {
      const parsed = Papa.parse<{ email: string; password: string; full_name?: string; role?: string }>(bulkCsv, {
        header: true,
        skipEmptyLines: true,
      });

      const results = { success: 0, errors: [] as string[] };

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        const rowNum = i + 2; // Account for header and 0-index

        if (!row.email || !row.password) {
          results.errors.push(`Row ${rowNum}: Email and password are required`);
          continue;
        }

        const role = (row.role?.toLowerCase() || 'auditor') as UserRole;
        if (!isSuperAdmin && role !== 'auditor') {
          results.errors.push(`Row ${rowNum}: Only Super Admins can create admin users`);
          continue;
        }

        try {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: row.email,
              password: row.password,
              full_name: row.full_name || '',
              role,
            }),
          });

          if (!response.ok) {
            const result = await response.json();
            results.errors.push(`Row ${rowNum}: ${result.error}`);
          } else {
            results.success++;
          }
        } catch {
          results.errors.push(`Row ${rowNum}: Failed to create user`);
        }
      }

      setBulkResults(results);
      if (results.success > 0) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setBulkResults({ success: 0, errors: ['Failed to parse CSV'] });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: Profile) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      role: user.role,
    });
    setShowEditModal(true);
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'danger';
      case 'admin':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        description={`${users.length} users`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <TableEmpty colSpan={6} message="No users found" />
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || '-'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? 'success' : 'default'}
                        size="sm"
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDateTime(user.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(user)}
                          disabled={user.id === currentProfile?.id}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        {isSuperAdmin && user.id !== currentProfile?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingUserId(user.id);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setError('');
        }}
        title="Create User"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            required
            helperText="Minimum 6 characters"
          />
          <Input
            label="Full Name"
            value={userForm.full_name}
            onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
          />
          <Select
            label="Role"
            options={roleOptions}
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
          />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} loading={saving}>
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={userForm.email}
            disabled
          />
          <Input
            label="Full Name"
            value={userForm.full_name}
            onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
          />
          {isSuperAdmin && (
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setBulkCsv('');
          setBulkResults(null);
        }}
        title="Bulk Import Users"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              CSV format (with headers):
            </p>
            <code className="text-xs bg-white p-2 rounded block">
              email,password,full_name,role<br />
              user@example.com,password123,John Doe,auditor
            </code>
          </div>

          <Textarea
            label="CSV Data"
            value={bulkCsv}
            onChange={(e) => setBulkCsv(e.target.value)}
            placeholder="Paste CSV data here..."
            rows={8}
          />

          {bulkResults && (
            <div
              className={`p-4 rounded-lg ${
                bulkResults.errors.length > 0
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-green-50 border border-green-200'
              }`}
            >
              <p className="font-medium text-sm">
                {bulkResults.success} user(s) created successfully
              </p>
              {bulkResults.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-600">Errors:</p>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {bulkResults.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
              Close
            </Button>
            <Button onClick={handleBulkImport} loading={saving} disabled={!bulkCsv.trim()}>
              Import Users
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
