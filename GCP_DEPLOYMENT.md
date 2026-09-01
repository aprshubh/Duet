# ☁️ DYUET — Google Cloud (GCP) Deployment Guide

This guide explains how to deploy **DYUET** to **Google Cloud Platform (GCP)**.

---

## ⚡ Option 1: Google Compute Engine (VM with Docker Compose) — Recommended & Easiest

This option runs your entire stack (PostgreSQL + Redis + Backend + Frontend) on a Google Compute Engine VM using Docker Compose.

### Step 1: Create a Compute Engine VM
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **Compute Engine** > **VM instances** and click **Create Instance**.
3. Configure the VM:
   - **Name**: `dyuet-server`
   - **Region**: Choose the closest region (e.g. `asia-south1` or `us-central1`).
   - **Machine Configuration**: `e2-micro` (Free Tier eligible) or `e2-small` / `e2-medium` (recommended for smooth Docker builds).
   - **Boot disk**: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (x86_64, 20 GB standard persistent disk).
   - **Firewall**:
     - ✅ Check **Allow HTTP traffic**
     - ✅ Check **Allow HTTPS traffic**
4. Click **Create**.

---

### Step 2: Connect to your VM
Click the **SSH** button next to your instance in the GCP Console, or connect from your local terminal using the `gcloud` CLI:
```bash
gcloud compute ssh dyuet-server
```

---

### Step 3: Clone Code & Run 1-Click Deployment
In the VM terminal, run:

```bash
# 1. Clone your project
git clone <YOUR-GITHUB-OR-GIT-REPO-URL> dyuet
cd dyuet

# 2. Make deployment script executable and run it!
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

The script will automatically:
- Install Docker and Docker Compose Plugin
- Build the Go Backend and React Frontend using multi-stage Docker builds
- Start PostgreSQL 16 with schema & Redis 7
- Launch all 4 services

---

### Step 4: Access Your App
Open your browser and navigate to:
```
http://<YOUR-GCP-VM-EXTERNAL-IP>
```

---

## 🔒 Free HTTPS / SSL Setup (Domain + Certbot)

When using a custom domain (e.g., `dyuet.yourdomain.com`):

1. **Point your domain**:
   In your DNS registrar (Cloudflare, GoDaddy, Namecheap), add an **A record** pointing to `<YOUR-GCP-VM-EXTERNAL-IP>`.

2. **Install Certbot on the VM**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y certbot
   ```

3. **Generate Certificate**:
   ```bash
   # Temporarily stop the frontend container to free port 80
   sudo docker compose stop frontend

   # Request SSL certificate
   sudo certbot certonly --standalone -d yourdomain.com

   # Restart frontend
   sudo docker compose start frontend
   ```

---

## 🛠️ Management Commands

```bash
# View live logs
sudo docker compose logs -f

# Check running containers
sudo docker compose ps

# Restart services
sudo docker compose restart

# Stop all services
sudo docker compose down
```
