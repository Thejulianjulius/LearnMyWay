# LearnMyWay Supabase Edge Function: `generate-lesson`

This Edge Function acts as the secure, server-side gateway between LearnMyWay and the Groq AI API.

## Security Architecture
- The Groq API key is **never** exposed in client-side JavaScript or browser network traffic.
- Stored exclusively in server-side Supabase Edge Function Secrets (`GROQ_API_KEY`).
- Validates requests, rate limits, and timeouts before reaching Groq.
- CORS-enabled for web app access from localhost and Vercel.

## Deployment to Supabase

### 1. Set the Server-Side Secret in Supabase
Do not put your Groq secret in git or `.env` in production. Add it directly to Supabase:

**Via Supabase Dashboard:**
1. Navigate to your [Supabase Project Dashboard](https://supabase.com/dashboard/project/hplfynwisqujtiilmgyl).
2. Go to **Project Settings** > **Edge Functions** (or **Edge Functions** in the left sidebar).
3. Under **Secrets**, click **Add new secret**.
4. Set Name: `GROQ_API_KEY`
5. Set Value: your Groq API key (begins with `gsk_`).
6. Click **Save**.

**Or via Supabase CLI:**
```bash
supabase secrets set GROQ_API_KEY=your_actual_groq_key_here
```

### 2. Deploy the Edge Function
Run the following command from the project root:
```bash
supabase functions deploy generate-lesson --no-verify-jwt
```
> **Note on `--no-verify-jwt`**: This allows guest users (unauthenticated visitors) to generate lessons using your public Supabase publishable key without being forced to register, fully preserving the guest experience.

### 3. (Optional) Customizing the Groq Model
The default model is configured as `llama-3.3-70b-versatile` in `index.ts`.
You can change it dynamically without redeploying by setting the `GROQ_MODEL` secret:
```bash
supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile
```

## Local Development
For local testing prior to Edge Function deployment, `vite.config.ts` includes a local server-side middleware that reads `GROQ_API_KEY` from your local `.env` file (without any `VITE_` prefix, so it is never bundled in frontend JavaScript).
