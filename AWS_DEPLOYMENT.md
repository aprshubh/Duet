# ☁️ Duet — AWS Deployment Guide

This guide takes you from zero to a live, production-ready **Duet** instance on **Amazon Web Services (AWS)**.

---

## ⚡ Option 1: AWS EC2 (Free Tier 12 Months) — Recommended

### Step 1: Launch an EC2 Instance
1. Login to **[AWS Console](https://console.aws.amazon.com/)** and navigate to **EC2**.
2. Click **Launch Instance**:
   - **Name**: `duet-server`
   - **OS Image**: **Ubuntu 24.04 LTS** or **Ubuntu 22.04 LTS** (64-bit x86)
   - **Instance Type**: `t2.micro` or `t3.micro` (Free Tier eligible - 750 hrs/mo free)
   - **Key Pair**: Select or create a new key pair (e.g. `duet-key.pem` and download it)
3. Under **Network Settings / Firewall (Security Group)**, check all 3 boxes:
   - ✅ **Allow SSH traffic** (Port 22) — From Anywhere or My IP
   - ✅ **Allow HTTP traffic from the internet** (Port 80)
   - ✅ **Allow HTTPS traffic from the internet** (Port 443)
4. Click **Launch Instance**.

---

### Step 2: Connect to your Server
Open PowerShell or your terminal on your computer, navigate to where you saved `duet-key.pem`:
```bash
ssh -i duet-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
```

---

### Step 3: Clone Code & Run 1-Click Deployment
Inside your server terminal, run:

```bash
# 1. Clone your repository
git clone <YOUR-GITHUB-REPO-URL> duet
cd duet

# 2. Make deployment script executable and run
chmod +x deploy-aws.sh
./deploy-aws.sh
```

The script will automatically:
- Install Docker & Docker Compose
- Start **PostgreSQL 16** with schema migrations
- Start **Redis 7** for fast room state
- Build & launch **Go Backend** (`duet-backend`)
- Build & launch **React + Nginx Frontend** (`duet-frontend`)

---

### Step 4: Access Your App
Open your browser and enter:
```
http://<YOUR-EC2-PUBLIC-IP>
```

---

## 🔒 Free HTTPS / SSL Setup (Certbot & Domain)

If you have a domain (e.g. `dyuet.com` or `movie.yourdomain.com`):

1. In your domain provider (GoDaddy, Namecheap, Cloudflare), add an **A record**:
   - **Host / Name**: `@` (or `movie`)
   - **Value / Points to**: `<YOUR-EC2-PUBLIC-IP>`

2. Install Certbot on your EC2 instance:
```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

3. Run Certbot to auto-configure SSL:
```bash
sudo certbot --nginx -d yourdomain.com
```

Now your app will be securely available at `https://yourdomain.com` with secure WebSockets (`wss://`).

---

## 🛠️ Management Commands

```bash
# View live logs
sudo docker compose logs -f

# Check running containers
sudo docker compose ps

# Restart services
sudo docker compose restart

# Stop services
sudo docker compose down
```
