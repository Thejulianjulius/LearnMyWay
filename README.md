# LearnMyWay

An AI-powered web app that teaches school topics through your personal interests, now with a complete Supabase student authentication and profile system.

## What it does
Pick an interest — Anime, Gaming, Football, Fashion, Beauty or TikTok — type in a school topic like Photosynthesis or Gravity, and get a personalized lesson generated just for you in a storytelling style.

## Key Features
- **AI-Powered Storytelling Lessons**: Generate engaging, immersive lessons powered by Groq's Llama 3.3 70B model.
- **Guest Access**: Visitors can immediately generate lessons without being forced to create an account.
- **Student Authentication**: Secure registration, email verification, login, and password recovery powered by Supabase Auth.
- **Student Profiles & RLS**: Private profile tracking student education level, learning interests, and member status, secured by PostgreSQL Row Level Security.
- **Student Dashboard**: Personalized dashboard showing saved lessons, learning history, profile management, and quick navigation.
- **Save Lessons**: Authenticated students can bookmark lessons directly from the generator to their library.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Radix UI / Lucide icons
- **Routing**: Wouter
- **AI Engine**: Groq API (`llama-3.3-70b-versatile`)
- **Backend & Auth**: Supabase (Auth + PostgreSQL + Row Level Security)
- **Deployment**: Vercel

## Environment & Secrets Configuration

### 1. Client Environment Variables (`.env`)
Create a `.env` file in the project root:

```env
# Client-side Supabase Configuration (Public Publishable Key)
VITE_SUPABASE_URL=https://hplfynwisqujtiilmgyl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_uUCWZo3DBX7WC4c2yu9a1w_HwEZkPvr

# Server-side Secret for Local Development (NOT prefixed with VITE_)
# Never exposed to client-side bundles.
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Supabase Edge Function Secret (Production)
In production, your Groq API key is stored securely inside Supabase Edge Functions:
- Go to **Supabase Dashboard > Project Settings > Edge Functions > Secrets**
- Add secret name: `GROQ_API_KEY`
- Add value: `your_groq_api_key_here`
- (Or via CLI: `supabase secrets set GROQ_API_KEY=your_key_here`)

## Database Setup (Supabase)
Run the script located in `supabase/schema.sql` in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql):
1. Creates the `profiles` table with user metadata, education level, and interests.
2. Configures Row Level Security (RLS) policies allowing students to access and edit only their own data.
3. Installs an automatic PostgreSQL trigger that creates a student profile on signup.
4. Creates the `saved_lessons` table with RLS so students can bookmark lessons.

## Getting Started
```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Build for production
npm run build
```

## Purpose
Portfolio project built to demonstrate AI integration, product thinking, and full-stack authentication design.
Built by Julian
