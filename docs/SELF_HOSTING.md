# Self-Hosting Mirar on Proxmox LXC (Ubuntu)

This guide walks you through deploying Mirar on a Proxmox LXC container running Ubuntu.

## Prerequisites

- Proxmox VE 7.x or 8.x
- Access to Proxmox web interface or CLI
- Basic familiarity with Linux command line

## Part 1: Create the LXC Container

### Option A: Via Proxmox Web UI

1. Download Ubuntu template:
   - Go to your storage → CT Templates → Templates
   - Download `ubuntu-22.04-standard` or `ubuntu-24.04-standard`

2. Create container:
   - Click "Create CT"
   - **General**: Set hostname (e.g., `mirar`), password, and container ID
   - **Template**: Select the Ubuntu template
   - **Disks**: 8GB minimum (16GB recommended)
   - **CPU**: 2 cores minimum
   - **Memory**: 2048 MB minimum (4096 MB recommended)
   - **Network**: Configure with your network settings (DHCP or static IP)
   - Check "Start after created"

### Option B: Via CLI

```bash
# On Proxmox host
pveam download local ubuntu-22.04-standard_22.04-1_amd64.tar.zst

pct create 100 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname mirar \
  --memory 4096 \
  --cores 2 \
  --rootfs local-lvm:16 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1 \
  --start 1
```

## Part 2: Initial Container Setup

```bash
# Enter the container (from Proxmox host)
pct enter 100

# Or SSH into it using its IP address
ssh root@<container-ip>

# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y curl git build-essential

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PM2 for process management
npm install -g pm2
```

## Part 3: Supabase Setup

You have two options for Supabase:

### Option A: Supabase Cloud (Recommended for simplicity)

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Note down:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - Anon/Public key
   - Service Role key (from Settings → API)

### Option B: Self-Hosted Supabase (Advanced)

If you want to self-host Supabase, you'll need Docker. This is more complex but keeps everything on-premise.

```bash
# Install Docker
apt install -y docker.io docker-compose

# Clone Supabase
git clone --depth 1 https://github.com/supabase/supabase /opt/supabase
cd /opt/supabase/docker

# Copy and configure environment
cp .env.example .env
nano .env  # Edit POSTGRES_PASSWORD, JWT_SECRET, etc.

# Start Supabase
docker-compose up -d
```

For self-hosted, your Supabase URL will be `http://localhost:8000` (or your container IP).

## Part 4: Deploy Mirar Application

### Clone and Configure

```bash
# Create app directory
mkdir -p /opt/mirar
cd /opt/mirar

# Clone the repository
git clone https://github.com/timmurdoch/Mirar-v2.git .

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
nano .env.local
```

### Configure Environment Variables

Edit `.env.local` with your Supabase credentials:

```bash
# For Supabase Cloud
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For Self-Hosted Supabase
# NEXT_PUBLIC_SUPABASE_URL=http://your-container-ip:8000
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-generated-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-generated-service-key
```

### Run Database Migrations

In the Supabase dashboard (or via psql for self-hosted):

1. Go to SQL Editor
2. Run each migration file in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql` (optional - adds sample data)

### Build and Start

```bash
# Build the production version
npm run build

# Test it works (Ctrl+C to stop)
npm start

# Start with PM2 for production
pm2 start npm --name "mirar" -- start

# Save PM2 process list and enable startup
pm2 save
pm2 startup
# Run the command it outputs
```

## Part 5: Create First Admin User

1. In Supabase Dashboard → Authentication → Users → Add User
2. Create a user with email and password
3. Run this SQL to make them a Super Admin:

```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'your-admin@email.com';
```

## Part 6: Configure Reverse Proxy (Optional but Recommended)

### Using Nginx

```bash
# Install nginx
apt install -y nginx

# Create site configuration
nano /etc/nginx/sites-available/mirar
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name mirar.yourdomain.com;  # Or use container IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/mirar /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site
nginx -t  # Test configuration
systemctl restart nginx
```

### Add SSL with Let's Encrypt (if using a domain)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d mirar.yourdomain.com
```

## Part 7: Access the Application

- **Without nginx**: `http://<container-ip>:3000`
- **With nginx**: `http://<container-ip>` or `https://mirar.yourdomain.com`

Login with the admin user you created.

## Maintenance Commands

```bash
# View application logs
pm2 logs mirar

# Restart application
pm2 restart mirar

# Stop application
pm2 stop mirar

# Update application
cd /opt/mirar
git pull
npm install
npm run build
pm2 restart mirar
```

## Resource Recommendations

| Users | RAM | CPU | Storage |
|-------|-----|-----|---------|
| 1-10 | 2GB | 2 cores | 8GB |
| 10-50 | 4GB | 2 cores | 16GB |
| 50-100 | 8GB | 4 cores | 32GB |

## Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs mirar --lines 50

# Check if port 3000 is in use
netstat -tlnp | grep 3000
```

### Database connection errors
- Verify Supabase URL and keys in `.env.local`
- Check if Supabase project is active (cloud) or Docker containers are running (self-hosted)

### Out of memory
```bash
# Increase container memory in Proxmox
# Or add swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Restart if needed
pm2 restart mirar
```

## Backup

### Database (via Supabase Dashboard)
- Settings → Database → Backups → Download backup

### Application
```bash
# Backup environment file
cp /opt/mirar/.env.local /backup/mirar-env-$(date +%Y%m%d).local
```
