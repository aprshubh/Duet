#!/bin/bash
set -e

echo "🛑 Freeing ports 80 and 8080..."
sudo fuser -k 80/tcp 8080/tcp 2>/dev/null || true
sudo pkill -9 server 2>/dev/null || true
sleep 1

echo "🚀 Starting Go backend on port 8080..."
cd /home/ubuntu/duet
nohup ./backend/server > /home/ubuntu/duet-backend.log 2>&1 &
sleep 1

echo "🔒 Configuring Nginx reverse proxy for duett.duckdns.org..."
sudo bash -c 'cat > /etc/nginx/sites-available/default << "EOF"
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name duett.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF'

echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx

echo "✨ Requesting Let'\''s Encrypt Free SSL Certificate..."
sudo certbot --nginx -d duett.duckdns.org --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo ""
echo "🎉 SUCCESS! SSL Certificate Installed!"
echo "🌐 Access your secure app at: https://duett.duckdns.org"