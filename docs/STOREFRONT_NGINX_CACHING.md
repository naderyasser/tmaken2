# Storefront static-asset caching (nginx)

The public storefront serves listing images from `/files/*` as **nginx static files**
straight off disk (`sites/<site>/public/files`) — they do not pass through Next.js or
Frappe. Each Frappe upload gets a unique URL, so a given `/files/` URL always returns the
same bytes; we cache it long and `immutable` so repeat visits skip both the re-download
**and** the conditional revalidation.

## Applied — review vhost (`:8080`, `aqar-marketplace-8080`)

The `/files/` location now sets:

```nginx
location /files/ {
    root /home/frappeuser/frappe-dev/sites/qarawi/public;
    try_files $uri =404;
    add_header Cache-Control "public, max-age=2592000, immutable";   # 30d, immutable
    access_log off;
}
```

Verified: first response carries `Cache-Control: public, max-age=2592000, immutable`;
repeat in-browser navigation serves every `/files/` image from cache (transferSize 0,
no network); a conditional request still 304s; a missing file still 404s.

## TODO — production vhost (`:443`)

The production marketplace is served by the **`:443` vhost** (`aqar-meena-alaqariya.conf`,
the cert-managed host — intentionally NOT modified here to avoid the certbot/cert trap).
Apply the **same one-liner** to that vhost's `/files/` location so production gets the
caching too:

```nginx
add_header Cache-Control "public, max-age=2592000, immutable";
```

Then `sudo nginx -t && sudo systemctl reload nginx`.

> Mirrors the existing `/_next/static/` caching block in the same vhosts. No app or
> backend code change — purely a static-asset response header.
