# 🚀 Quick Start - Deploy to Vercel

## Option 1: One-Click Deploy (أسرع طريقة)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/naderyasser/base-meena-frontend)

## Option 2: Manual Deploy

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
```bash
cd hr-management-system-ui
vercel --prod
```

### Step 4: Set Environment Variable
```bash
vercel env add NEXT_PUBLIC_FRAPPE_URL
# Enter: https://your-frappe-backend.com
```

## Important: Configure Frappe Backend

Add to `site_config.json`:
```json
{
  "allow_cors": "*",
  "cors_origin": ["https://your-app.vercel.app"]
}
```

## Done! 🎉

Your app will be live at: `https://your-project.vercel.app`

For detailed instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
