# ⚽ KhelaHobe — Football Match Manager

**KhelaHobe** (Bengali for *"The Game is On"*) is a premium, feature-rich web application designed for recreational football groups, clubs, and squads. It simplifies match organization, RSVP scheduling, squad division, goal tracking, and dynamic player statistic logging.

---

## 🚀 Key Features

### 📅 Match Scheduling & Rules
- **Notice Requirements:** Enforces a strict 3-hour notice period for creating new bookings.
- **Auto-History Transition:** Matches automatically transition to "History" 5 hours after kick-off.
- **Group Champion Tracker:** The group match history displays computed winners with a trophy indicator.

### 👥 Squad & Team Management
- **Searchable Multi-RSVP:** Search and add multiple squad members with a light-green visual highlight.
- **Team Roster Colors:** Players in team rosters are styled with their respective team jersey colors (at 25% opacity).
- **Expandable Team cards:** Expand teams on the match page to view full player positions, guest labels, and captain indicators.

### 📊 Matchday Share Cards
- **Stat Summary:** Instantly generate a shareable image card representing the champion team, runners-up, top scorer, and points/GD.
- **Team Rankings:** Displays calculated points and Goal Differences (GD) next to each team.

### 💬 Social & Forum
- **Group Forums:** Categorized discussions (Announcements, General, Looking for Players, etc.) with badges.
- **Unread Badges:** Live unread notification bell counts and chat badges keep everyone synchronized.

### 🔒 Custom Password Recovery
- **Bypass SMTP Limits:** Custom security questions bypass free-tier Supabase email rate limits.
- **Theme-appropriate:** Football-themed security questions (e.g., favorite players, clubs, stadiums).

---

## 🛠️ Technology Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth:** [Supabase](https://supabase.com/) (Postgres, GoTrue Auth)
- **State & Realtime:** Supabase Realtime Channels
- **Icons:** [Lucide React](https://lucide.dev/)

---

## ⚙️ Project Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory and add the following keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Database Migrations
Run the migrations in the Supabase SQL Editor:
- `supabase_schema.sql` (Core DB setup)
- `migration_security_questions.sql` (Security questions recovery columns)

### 4. Start Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```
