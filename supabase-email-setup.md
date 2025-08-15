# Supabase Email Template Setup Guide

## Overview
This guide explains how to set up the custom email confirmation template in Supabase for your IdeaValidator application.

## 1. Upload the Email Template

### Option A: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select **Confirm signup** template
4. Replace the existing HTML with the content from `email-confirmation-template.html`
5. Click **Save**

### Option B: Supabase CLI
```bash
# If using Supabase CLI
supabase gen types typescript --project-id YOUR_PROJECT_ID > database.types.ts
```

## 2. Template Variables

The template uses these Supabase variables that are automatically populated:

- `{{ .ConfirmationURL }}` - The email confirmation link
- `{{ .Email }}` - The user's email address  
- `{{ .SiteURL }}` - Your site's base URL
- `{{ .TokenHash }}` - The confirmation token (included in ConfirmationURL)

## 3. Supabase Configuration

### Email Settings (Dashboard → Authentication → Settings)

```
Site URL: https://your-domain.com
Redirect URLs: 
  - https://your-domain.com/**
  - http://localhost:3000/**

Email Templates:
✅ Enable email confirmations
✅ Enable secure email change
✅ Enable email change confirmations
```

### SMTP Configuration (Optional)
For production, configure your own SMTP:

```
SMTP Host: your-smtp-host.com
SMTP Port: 587
SMTP User: your-email@domain.com
SMTP Pass: your-smtp-password
SMTP Sender Name: IdeaValidator
SMTP Sender Email: noreply@your-domain.com
```

## 4. Environment Variables

Add these to your `.env.local`:

```env
# Supabase Email Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Your domain for email links
NEXT_PUBLIC_DOMAIN=https://your-domain.com
```

## 5. Custom Domain Setup (Production)

For a professional email experience:

1. **Set up custom domain in Supabase:**
   - Go to Dashboard → Settings → General
   - Add your custom domain
   - Update DNS records as instructed

2. **Update email sender:**
   - Use `noreply@your-domain.com` instead of default Supabase sender
   - This improves deliverability and brand trust

## 6. Testing the Email Template

### Test Email Confirmation Flow:
1. Sign up a new user in your app
2. Check email inbox for confirmation
3. Verify the email looks professional and matches your brand
4. Click confirmation link to ensure it works
5. Confirm user lands on the payment gate (pay-first model)

### Email Client Testing:
Test the template across different email clients:
- Gmail (web, mobile)
- Outlook (web, desktop)
- Apple Mail
- Yahoo Mail

## 7. Email Template Features

✅ **Professional Design:**
- Matches IdeaValidator brand colors (blue-to-purple gradient)
- Consistent typography and spacing
- Mobile-responsive design

✅ **Security Features:**
- Clear security notice about link expiration
- Warning about suspicious emails
- Fallback link if button doesn't work

✅ **Brand Elements:**
- IdeaValidator logo and name
- Consistent messaging about SaaS discovery
- Professional footer with contact links

✅ **User Experience:**
- Clear call-to-action button
- Benefit highlights to build excitement
- Multiple ways to confirm (button + text link)

## 8. Customization Options

### Modify Content:
Edit the template to:
- Update company information
- Change feature highlights
- Customize security messaging
- Add social media links

### Styling Changes:
- Update colors in CSS variables
- Modify font family
- Adjust spacing and layout
- Add company logo image

### Dynamic Content:
Add more personalization:
```html
<!-- Add user name if available -->
<div class="greeting">Welcome {{ .UserMetaData.full_name | default "there" }}! 👋</div>

<!-- Add selected plan info -->
<p>You selected the {{ .UserMetaData.selected_plan | title }} plan...</p>
```

## 9. Email Deliverability Tips

✅ **Best Practices:**
- Use professional "from" address
- Include unsubscribe link (required by law)
- Keep HTML clean and semantic
- Test spam score before deployment
- Use alt text for images

✅ **DNS Records:**
Set up proper email authentication:
- SPF record
- DKIM signing
- DMARC policy

## 10. Monitoring and Analytics

Track email performance:
- Open rates
- Click-through rates
- Delivery rates
- Spam complaints

Consider integrating with:
- SendGrid for advanced analytics
- Mailgun for better deliverability
- Postmark for transactional emails

## Sample Email Preview

The email will display:
1. **Header:** IdeaValidator logo with gradient background
2. **Greeting:** Personalized welcome message
3. **Content:** Clear explanation and benefits
4. **CTA:** Prominent "Confirm Email Address" button
5. **Fallback:** Text link for accessibility
6. **Security:** Important security notice
7. **Footer:** Professional contact information

This creates a cohesive brand experience from signup through email confirmation to payment and dashboard access.