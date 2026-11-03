
# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name __HOST__;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }

    # ADMS / ZKTeco terminals speak plain HTTP only - they have no SSL stack and
    # silently stop pushing punches when handed a 301. This MUST stay above the
    # redirect below (same block as qarawi.conf).
    location ^~ /iclock/ {
        rewrite ^/iclock/cdata(.*)$ /api/method/base_meena.biometric_management.adms.cdata$1 break;
        rewrite ^/iclock/getrequest(.*)$ /api/method/base_meena.biometric_management.adms.getrequest$1 break;
        rewrite ^/iclock/devicecmd(.*)$ /api/method/base_meena.biometric_management.adms.devicecmd$1 break;
        proxy_pass http://frappe-priority;
        proxy_http_version 1.1;
        proxy_set_header X-Frappe-Site-Name __SITE__;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

