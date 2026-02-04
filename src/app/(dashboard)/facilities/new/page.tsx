'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { createClient } from '@/lib/supabase/client';
import { AUSTRALIAN_STATES } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewFacilityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    venue_name: '',
    venue_address: '',
    town_suburb: '',
    postcode: '',
    state: '',
    latitude: '',
    longitude: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();

      const { data, error: insertError } = await supabase
        .from('facilities')
        .insert({
          venue_name: formData.venue_name,
          venue_address: formData.venue_address || null,
          town_suburb: formData.town_suburb || null,
          postcode: formData.postcode || null,
          state: formData.state || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      // Log the creation
      if (data) {
        await supabase.from('change_logs').insert({
          facility_id: data.id,
          entity_type: 'facility',
          field_name: '_created',
          old_value: null,
          new_value: formData.venue_name,
          changed_by: user.user?.id,
        });
      }

      router.push(`/facilities/${data.id}`);
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

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
          title="New Facility"
          description="Add a new sports facility to the database"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Input
                  label="Venue Name"
                  value={formData.venue_name}
                  onChange={(e) => handleChange('venue_name', e.target.value)}
                  required
                  placeholder="e.g., Melbourne Sports Stadium"
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Address"
                  value={formData.venue_address}
                  onChange={(e) => handleChange('venue_address', e.target.value)}
                  placeholder="e.g., 123 Sports Drive"
                />
              </div>

              <Input
                label="Town/Suburb"
                value={formData.town_suburb}
                onChange={(e) => handleChange('town_suburb', e.target.value)}
                placeholder="e.g., Melbourne"
              />

              <Input
                label="Postcode"
                value={formData.postcode}
                onChange={(e) => handleChange('postcode', e.target.value)}
                placeholder="e.g., 3000"
              />

              <Select
                label="State"
                options={AUSTRALIAN_STATES}
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="Select state"
              />

              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Location Coordinates
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleChange('latitude', e.target.value)}
                    placeholder="e.g., -37.8136"
                    helperText="Decimal degrees (e.g., -37.8136)"
                  />
                  <Input
                    label="Longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleChange('longitude', e.target.value)}
                    placeholder="e.g., 144.9631"
                    helperText="Decimal degrees (e.g., 144.9631)"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href="/facilities">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" loading={loading}>
                Create Facility
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
