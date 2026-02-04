# Mirar - Sports Facility Audit System

A mobile and tablet-friendly web application for building and maintaining a database of sports facilities, capturing structured audit data, and visualizing facilities on an interactive map.

## Features

- **Facility Management**: Create, view, and edit sports facilities with baseline data
- **Map View**: Interactive OpenStreetMap with facility markers, tooltips, and filters
- **Configurable Questionnaires**: Versioned audit questionnaires with multiple question types
- **Audit Data Capture**: Capture structured audit data tied to questionnaire versions
- **Change History**: Immutable audit trail of all facility and audit changes
- **CSV Import/Export**: Bulk operations with validation and error reporting
- **Role-Based Access**: Auditor, Admin, and Super Admin roles with RLS enforcement

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Map**: MapLibre GL JS with OpenStreetMap tiles
- **CSV**: PapaParse for import/export

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account and project

### Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase**

   Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Run database migrations**

   Execute the SQL files in `supabase/migrations/` in order:
   - `001_initial_schema.sql` - Tables and functions
   - `002_rls_policies.sql` - Row Level Security policies
   - `003_seed_data.sql` - Sample data (optional)

4. **Create initial Super Admin user**

   In Supabase dashboard:
   - Go to Authentication → Users → Add User
   - Create a user with email/password
   - Run SQL to set their role:
     ```sql
     UPDATE public.profiles
     SET role = 'super_admin'
     WHERE email = 'admin@example.com';
     ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## User Roles & Permissions

| Capability | Auditor | Admin | Super Admin |
|------------|---------|-------|-------------|
| View facilities | ✓ | ✓ | ✓ |
| Create facilities | ✓ | ✓ | ✓ |
| Edit audit data | ✓ | ✓ | ✓ |
| Export data | ✗ | ✓ | ✓ |
| Configure questionnaire | ✗ | ✓ | ✓ |
| Configure tooltips/filters | ✗ | ✓ | ✓ |
| Create Auditors | ✗ | ✓ | ✓ |
| Create Admins | ✗ | ✗ | ✓ |
| Delete users | ✗ | ✗ | ✓ |
| Delete facilities | ✗ | ✗ | ✓ |

## Operational Documentation

### Bulk User Creation

1. Navigate to **Users** page (Admin/Super Admin only)
2. Click **Bulk Import** button
3. Paste CSV data with headers: `email,password,full_name,role`
4. Click **Import Users**
5. Review results and download error report if needed

Example CSV:
```csv
email,password,full_name,role
john@example.com,SecurePass123,John Smith,auditor
jane@example.com,SecurePass456,Jane Doe,admin
```

### Questionnaire Versioning

The questionnaire system uses versioning to maintain historical data integrity:

1. **Create Version**: Click "New Version" to create a draft questionnaire
2. **Add Sections**: Organize questions into logical groups
3. **Add Questions**: Define questions with types:
   - String (text input)
   - Number (numeric input)
   - List (dropdown select)
   - Radio (single choice)
   - Checkbox (multi-select)
4. **Publish**: Freeze the structure and make it active for audits
5. **Archive**: When publishing a new version, previous versions are archived

**Retiring Questions**: Questions can be retired to hide them from new audits while preserving historical data. Retired questions cannot be deleted.

### CSV Export/Import

#### Export Templates

1. Go to **Import/Export** page
2. Select questionnaire version
3. Download:
   - **Facility Template**: Baseline fields only
   - **Audit Template**: Baseline + question columns
   - **Full Export**: All facilities with latest audit data

#### Column Naming

- Facility fields: `facility_id`, `venue_name`, `venue_address`, `town_suburb`, `postcode`, `state`, `latitude`, `longitude`
- Question fields: `q__<question_key>` (e.g., `q__facility_type`, `q__overall_condition`)

#### Import Rules

- `facility_id` blank → Create new facility (UUID generated)
- `facility_id` present → Update existing facility
- `venue_name` is required for all rows
- Audit answers matched to selected questionnaire version

### Change Logs

Every change to facility baseline fields and audit answers creates an immutable log entry containing:
- What changed (field name or question key)
- Old and new values
- Who made the change
- When the change occurred

View change logs on the Facility Detail page under the "Change History" tab (Admin/Super Admin only).

### Map Configuration

Admins can configure which fields appear in:
- **Tooltips**: Shown when clicking on facility markers
- **Filters**: Available as filter options above the map

Configuration is stored in `tooltip_config` and `filter_config` tables.

## Database Schema

Key tables:
- `profiles` - User profiles with roles
- `facilities` - Facility baseline data
- `questionnaire_versions` - Versioned questionnaire definitions
- `sections` - Question groupings
- `questions` - Individual questions
- `audits` - Audit snapshots tied to facilities and questionnaire versions
- `audit_answers` - Question responses
- `change_logs` - Immutable audit trail

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Self-hosted

Build and run:
```bash
npm run build
npm start
```

## Scale Targets

- 200-300 facilities
- 50-100 users
- Always online (no offline support)
- Single organization per deployment

## License

MIT
