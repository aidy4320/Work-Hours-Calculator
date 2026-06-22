# Work Hours Calculator Specification

## Overview
A cloud-based, multi-user time tracking application for freelancers and self-employed contractors to monitor daily work hours and track progress towards monthly work targets. Each user registers a personal account, logs in securely, and can access their data from any computer or device. The system alerts users when they reach their monthly hour goals.

## Purpose
Help independent professionals track their work hours accurately, manage their workload, and ensure they meet their monthly hour commitments to clients or personal goals — from anywhere, on any device, with their data securely stored in the cloud.

---

## Functional Requirements

### 1. Account Registration & Authentication
- New users register with a **username, email, and password**
- **Username** is unique and is the login identifier; **email** is still required (for password
  reset and notifications) and is also unique
- Passwords are stored securely (hashed and salted, never in plain text)
- Registered users **log in with username + password** from any computer or device (username is
  resolved to the account's email server-side; the email is never exposed to the client)
- The username is shown in the app as the signed-in identity
- Users can log out, ending their session securely
- Authenticated sessions are maintained via secure tokens (e.g., JWT or signed session cookies)
- Users can reset a forgotten password via an email-based reset flow
- Each user can only access their own data — accounts are fully isolated from one another
- Optional: email verification on registration to confirm ownership of the address

### 2. User Profile & Settings
- User must be able to set their target working hours per month
- User can define standard working hours per day (e.g., 8, 9, or flexible)
- Settings persist in the database and are tied to the user's account
- Each registered user has their own independent profile and settings (multi-user support)

### 3. Daily Time Tracking
- For a given day, the user first chooses the **entry type** — work / vacation / holiday
- The **hours field is shown only when "work" is selected**; vacation/holiday have no hours field
- For a work entry, the user enters hours as decimal (e.g., 7.5) or whole numbers (e.g., 8)
- A **vacation/holiday** day requires no hours: it automatically **credits the user's standard
  daily hours** toward the monthly total (see §4), so the day off counts toward the goal
- User can edit previously logged hours, or change/clear a day-off marking, for any day
- User can delete logged hours / day-off entries for any day
- Time entries include: date, an entry type (work / vacation / holiday), hours worked (for work),
  and optional notes/project name
- Each entry is timestamped when created/modified

> This day-off marking lives in the **time-entry flow** and **affects the hour calculation**. It is
> separate from the visual calendar markings in §8 (which do not affect calculations).

### 4. Monthly Tracking & Progress
- System displays total hours for the current month, where
  **total = logged work hours + (vacation/holiday days × standard daily hours)**
- System displays remaining hours needed to reach monthly target (target − total)
- Vacation/holiday days therefore **reduce the remaining hours** just like worked hours
- System shows progress as percentage (e.g., "65% of monthly goal")
- System displays daily breakdown for the current month
- User can view data for previous months (read-only)

### 5. Alerts & Notifications
- Alert triggered when user reaches or exceeds monthly target hours
- Alert notification appears in the UI with a message confirming goal achievement
- Alert is dismissible by the user
- Alert includes the date and exact hour when the milestone was reached

### 6. Data Persistence & Cross-Device Access
- All time entries stored in a centralized cloud database (not local storage)
- User settings (monthly target, standard hours) stored and retrieved per account
- Historical data retained for viewing previous months
- No automatic data expiration
- Data is synced through the server, so a user sees the same up-to-date data on every computer/device they log in from
- Changes made on one device are reflected on all other devices after refresh/sync

### 7. Email Notifications
The system can send update emails to the user's registered email address. All email types are
opt-in/opt-out via user preferences (see §2 / Data Model), and emails are sent to the address
on the user's account.

- **Behind-on-target warning**: When the user is significantly behind their monthly pace, an
  email warns them. "Behind" is defined by comparing elapsed share of the month against share
  of the target reached (e.g. ≥80% of the month has passed but <50% of the target is met). The
  exact threshold is configurable per user (default provided).
- **Hour-logging reminder**: A periodic reminder (e.g. daily or weekly, per user preference) to
  log hours if none were logged in the configured period.
- **Goal-achieved confirmation**: When the monthly target is reached/exceeded, an email confirms
  the achievement (in addition to the in-app alert).
- **Monthly summary**: At the end of each month, an email summarizes total hours worked vs. the
  target for that month.
- Each email type can be independently enabled/disabled by the user.
- A given notification is sent at most once per relevant period (no duplicate emails for the same
  event/period — tracked server-side).
- Emails are sent server-side on a schedule (e.g. a scheduled job / cron) and/or on triggering
  events; they do not depend on the user having the app open.
- Every notification email includes a way to manage/disable email preferences.

### 8. Calendar & Day Marking
- A calendar page shows a monthly grid where each day displays its marking, if any.
- A user can mark a day as one of: **work day**, **vacation**, or **holiday**.
- Each day has at most one marking; the user can change or remove it.
- Markings are allowed on past, present, and future dates (e.g. to plan a vacation ahead).
- Each marking type is shown distinctly (e.g. color/label) so the month is readable at a glance.
- The calendar also indicates days that have logged hours (so work activity is visible alongside markings).
- Markings are **visual/informational only**: they do **not** change the monthly hour target or
  progress/remaining-hours math. Hours come solely from logged time entries.
- The calendar supports navigating between months (previous/next), like the rest of the app.

---

## User Stories

### Story 0a: Register an Account
**As a** new freelancer  
**I want to** create an account with my email and a password  
**So that** I can have my own private, secure workspace

**Acceptance Criteria:**
- I can sign up with a valid email and a password
- I get an error if the email is already registered
- My password is stored securely (never in plain text)
- After registering I can log in immediately
- I only ever see my own data, never another user's

### Story 0b: Log In From Any Computer
**As a** freelancer  
**I want to** log in from any computer or device  
**So that** I can access my hours wherever I am

**Acceptance Criteria:**
- I can log in with my email and password from any browser
- I stay logged in for the session via a secure token/cookie
- I can log out, which ends my session
- If I forget my password, I can reset it via an email link
- My data is identical and up to date across all devices I log in from

### Story 1: Set Monthly Work Target
**As a** freelancer  
**I want to** define my monthly work hour target  
**So that** I know exactly how many hours I need to work each month

**Acceptance Criteria:**
- I can enter a number (e.g., 160 hours)
- The value is saved and persists across sessions
- I can change the value anytime
- The new value applies to future months

### Story 2: Log Daily Work Hours
**As a** freelancer  
**I want to** log how many hours I worked today  
**So that** I can track my progress

**Acceptance Criteria:**
- I can quickly enter hours worked (e.g., 8.5)
- I can add an optional note about the work/project
- I can save multiple entries per day if needed
- The entry is saved immediately to the database

### Story 3: View Monthly Progress
**As a** freelancer  
**I want to** see my total hours for this month and how many more I need  
**So that** I can plan my work schedule

**Acceptance Criteria:**
- Dashboard shows: hours worked, hours remaining, percentage complete
- Data is clearly visible and easy to understand
- Shows breakdown by day/week (optional)
- Updates immediately after logging new hours

### Story 4: Receive Completion Alert
**As a** freelancer  
**I want to** be notified when I complete my monthly hour goal  
**So that** I know I've met my commitment

**Acceptance Criteria:**
- Alert appears automatically in the UI when goal is reached
- Alert shows the exact time the milestone was achieved
- I can dismiss the alert
- Alert persists in the UI until dismissed

### Story 4b: Receive Email Updates
**As a** freelancer  
**I want to** get email updates about my progress  
**So that** I stay on track even when I'm not in the app

**Acceptance Criteria:**
- I get a warning email when I'm significantly behind my monthly target pace
- I get a reminder email if I haven't logged hours for a while
- I get a confirmation email when I reach my monthly goal
- I get a monthly summary email at the end of the month
- I can turn each type of email on or off in my settings
- Emails go to my account's email address and include an option to manage preferences

### Story 5: Edit Previous Entries
**As a** freelancer  
**I want to** edit or delete hours I logged on previous days  
**So that** I can correct mistakes

**Acceptance Criteria:**
- I can click on any logged entry to edit it
- I can change the hours and/or notes
- I can delete an entry entirely
- Changes are saved to the database immediately

### Story 6: View Historical Data
**As a** freelancer  
**I want to** see my work hours from previous months  
**So that** I can review my productivity history

**Acceptance Criteria:**
- I can navigate to previous months
- Data is displayed but not editable (read-only)
- Historical months show totals and daily breakdown
- Navigation is intuitive (previous/next month buttons)

### Story 7: Mark Days on a Calendar
**As a** freelancer  
**I want to** see a calendar and mark each day as a work day, vacation, or holiday  
**So that** I have a clear visual overview of my month

**Acceptance Criteria:**
- I can open a calendar page showing the current month as a grid
- I can click a day and mark it as work day, vacation, or holiday
- I can change or clear a day's marking
- Each marking type is visually distinct, and days with logged hours are indicated
- I can navigate to other months (previous/next)
- I can mark future days (e.g. plan a vacation)

---

## Edge Cases

### 1. Time Entry Validation
- **Invalid input (negative numbers)**: System should reject and show error message
- **Decimal precision**: System should handle values like 7.5, 8.25, accepting up to 2 decimal places
- **Zero hours**: User can enter 0 hours for a day (no work)
- **Excessive hours**: User can enter more than 12 hours in a day (no upper limit)
- **Vacation/holiday credit**: A vacation/holiday day credits the standard daily hours; if standard daily hours is 0, the credit is 0
- **Day-off + work on same day**: A vacation/holiday day is counted as the standard-hours credit and ignores any work hours logged the same day, so a day is never counted twice
- **Changing entry type**: Switching a day between work and vacation/holiday recalculates the month's total immediately

### 2. Date Boundaries
- **Future dates**: User cannot log hours for future dates (system enforces this)
- **Very old dates**: User can log hours for dates from previous months/years (no lower boundary limit)
- **Daylight saving transitions**: Application must handle dates during DST transitions correctly

### 3. Monthly Goal Edge Cases
- **Exact target match**: Alert triggers when hours equal exactly the target (not just when exceeding)
- **Already exceeded**: If user already exceeded target when viewing, they should still see the achievement message
- **Goal changed mid-month**: If user changes monthly target mid-month, progress recalculates immediately
- **Goal set to 0**: System allows setting target to 0 (user would immediately meet goal)

### 4. Month Definition
- **Month boundaries**: System uses calendar months (Jan 1 - Jan 31, Feb 1 - Feb 28/29)
- **Leap years**: February months in leap years correctly handle the 29th day
- **Year boundaries**: Correctly handles entries spanning year transitions (Dec - Jan)

### 5. Database & Data Integrity
- **Simultaneous edits**: If user edits on multiple tabs/devices, last edit wins
- **Missing database**: If database becomes unavailable, app should show error (not crash)
- **Corrupt data**: Invalid entries in database are skipped (application continues functioning)
- **Large datasets**: App should handle 3+ years of daily entries without performance degradation

### 6. UI/UX Edge Cases
- **Browser refresh**: After logging hours and refreshing page, data is still visible
- **Empty month**: If no hours logged in a month, UI displays "0 hours" not errors
- **Timezone awareness**: All dates stored consistently (UTC recommended)
- **Mobile responsiveness**: Entry form remains usable on small screens

### 7. Alerts & Notifications
- **Multiple alerts**: If user views app after already reaching goal, alert still displays
- **Alert dismissal**: Once dismissed, alert doesn't reappear for the same milestone
- **Goal reached with one entry**: Logging a single large entry that meets/exceeds goal triggers alert correctly
- **Multiple entries reaching goal**: If two entries together reach goal, alert triggers at the completing entry

### 8. Number Formatting
- **Decimal places**: Display shows 1-2 decimal places (e.g., 7.5, 160.00)
- **Large numbers**: Display correctly formats if someone enters 1000+ hours
- **Rounding**: Totals calculated without rounding errors (use precise arithmetic)

### 9. Email Notifications
- **No duplicates**: The same notification for the same period/event is sent only once, even if the triggering condition is re-evaluated multiple times
- **Opt-out respected**: If a user disables an email type, no emails of that type are sent
- **Target of 0**: Behind-on-target emails are not sent when the monthly target is 0 (goal already met)
- **Goal reached early**: Once the goal is reached, behind-on-target and reminder emails for that month stop
- **Delivery failure**: If an email fails to send, the app continues to function; sending is retried/logged and never blocks in-app usage
- **Timezone**: "End of month" and reminder schedules respect a sensible timezone (UTC by default; user timezone if available)
- **Unverified email**: If email verification is enabled and the address is unverified, notification emails are withheld until verified

### 10. Calendar & Day Marking
- **One marking per day**: A day can have at most one marking; re-marking replaces the previous one
- **Clearing**: Removing a marking returns the day to its unmarked state
- **Future dates**: Marking future days is allowed (unlike logging hours, which forbids future dates)
- **Unmarked days**: Days with no marking render normally (no error)
- **Marking vs. hours**: A day can have both a marking and logged hours; markings never alter target/progress math
- **Timezone**: Calendar days use the same date handling as the rest of the app (UTC-consistent)

---

## Out of Scope

### Features NOT included:
1. **Team/shared workspaces**: Each account is single-user and private; no shared or team workspaces, no inviting collaborators (the system supports many independent users, but not collaboration between them)
2. **Third-party / social login**: No "Sign in with Google/Apple" — email + password only (may be added later)
3. **Invoice/Payment generation**: No billing, payment calculation, or invoice export
4. **Project/Client tracking**: No project categorization or client billing rates
5. **Time clock/Timer**: No automatic timer that runs in the background
6. **Mobile app**: Web-based only (accessible via mobile browser), no native iOS/Android apps
7. **API/Integration**: No external integrations (Jira, Slack, etc.)
8. **Advanced analytics**: No charts, graphs, or statistical analysis
9. **Recurring templates**: No ability to schedule recurring work entries
10. **Overtime calculation**: No special rules for overtime hours or rates
11. **Break tracking**: No tracking of breaks or lunch time
12. **Leave-balance management**: Vacation/holiday days can be entered and credit standard daily hours toward the monthly target (see §3/§4), but there is no leave-balance accounting, accrual, approval workflow, or distinct vacation/sick quotas. (The §8 calendar markings remain visual only.)
13. **Reporting/PDF export**: No report generation or PDF export functionality
14. **Collaboration features**: No comments, sharing, or team communication
15. **Offline mode**: Requires a connection to the server; no offline-first local caching
16. **Dark mode**: No theme customization (default theme only)
17. **Multiple currencies**: No currency conversion or multi-currency support
18. **Geolocation/GPS**: No location tracking for work
19. **Screenshots/Activity monitoring**: No surveillance features
20. **SMS / push notifications**: Updates are sent via email and shown in-app only — no SMS or mobile push notifications (note: email notifications for progress, reminders, goal achievement, and monthly summaries ARE included — see Functional Requirements §7)

---

## Data Model

### User Account Table
```
- userId (unique identifier)
- email (unique, used for login)
- passwordHash (hashed + salted password, never plain text)
- emailVerified (boolean, optional)
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Password Reset Token Table (optional, for reset flow)
```
- tokenId (unique identifier)
- userId (foreign key)
- tokenHash (hashed reset token)
- expiresAt (timestamp)
- usedAt (timestamp, nullable)
```

### User Settings Table
```
- userId (foreign key -> User Account)
- monthlyTargetHours (number)
- standardDailyHours (number)
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Time Entry Table
```
- entryId (unique identifier)
- userId (foreign key)
- date (date)
- entryType (enum: work | vacation | holiday, default work)
- hoursWorked (decimal number - used for work entries; vacation/holiday credit standard daily hours)
- notes (optional text)
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Alert/Milestone Table
```
- alertId (unique identifier)
- userId (foreign key)
- month (date - first day of month)
- achievedAt (timestamp)
- dismissed (boolean)
```

### Notification Settings Table
```
- userId (foreign key -> User Account)
- behindTargetEnabled (boolean, default true)
- behindTargetThresholdPercent (number, e.g. 50 - send if target progress is below this when the month is mostly elapsed)
- reminderEnabled (boolean, default true)
- reminderFrequency (enum: daily | weekly, default weekly)
- goalAchievedEmailEnabled (boolean, default true)
- monthlySummaryEnabled (boolean, default true)
- createdAt (timestamp)
- updatedAt (timestamp)
```

### Notification Log Table
```
- notificationId (unique identifier)
- userId (foreign key)
- type (enum: behind_target | reminder | goal_achieved | monthly_summary)
- period (text/date - the period the notification applies to, e.g. "2026-06" - used to prevent duplicates)
- sentAt (timestamp)
- status (enum: sent | failed)
```

### Day Marking Table
```
- markingId (unique identifier)
- userId (foreign key)
- date (date - one marking per user per date)
- dayType (enum: work | vacation | holiday)
- createdAt (timestamp)
- updatedAt (timestamp)
```

---

## Non-Functional Requirements

1. **Performance**: Page load time < 2 seconds
2. **Database**: Supports minimum 10 years of daily entries
3. **Availability**: Hosted online (cloud), accessible 24/7 from any computer; no scheduled downtime
4. **Usability**: UI intuitive enough for first-time users without documentation
5. **Data accuracy**: Arithmetic calculations precise to 2 decimal places minimum
6. **Browser support**: Chrome, Firefox, Safari (latest versions)
7. **Security**: All traffic served over HTTPS; passwords hashed with a strong algorithm (e.g., bcrypt/argon2); session tokens signed and expiring; protection against common attacks (XSS, CSRF, SQL injection)
8. **Authorization**: Every data request is scoped to the authenticated user; one user can never read or modify another user's data
9. **Hosting**: Deployed to a remote server/cloud platform with a public URL (not localhost), so users can reach it from any machine

---

## Acceptance Criteria (MVP)

1. User can register an account and log in ✓
2. User can log in from any computer and see the same data ✓
3. User can set monthly hour target ✓
4. User can log hours for today, or mark the day as vacation/holiday (credits standard hours) ✓
5. User can view current month progress ✓
6. User receives alert when goal is reached ✓
7. User can edit/delete previous entries ✓
8. Data persists in a cloud database, isolated per user ✓
9. User can mark days on a calendar (work / vacation / holiday) ✓
10. All edge cases handled gracefully ✓

---

**Version**: 2.4  
**Last Updated**: 2026-06-18  
**Status**: Ready for Development
