#!/usr/bin/env bash
set -e

echo "🔒 Configuring Nginx reverse proxy for duett.duckdns.org..."
sudo bash -c 'cat > /etc/nginx/sites-available/default << "EOF"
server {
    listen 80;
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

echo "✨ Requesting Let's Encrypt Free SSL Certificate..."
sudo certbot --nginx -d duett.duckdns.org --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo ""
echo "🎉 SSL Certificate Successfully Installed!"
echo "🌐 Access your secure app at: https://duett.duckdns.org"
