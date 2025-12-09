# Doctor D Doctor

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Doctor D Doctor - Architecture Overview

## System Architecture

This project is a full-stack clinic management system built with Next.js, React, and MongoDB. It is split into two main modules:

---

### 1. Patient Booking Portal
- **Purpose:** Allows patients to book appointments online.
- **Features:**
  - New patients can register and book appointments.
  - Returning patients use a unique Visit ID for quick booking and access to previous records.
  - Payment options (cash/online) are tracked.

---

### 2. Doctor & Nurse Dashboard
- **Purpose:** Internal dashboard for clinic staff.
- **Features:**
  - **Doctor View:**
    - See active patients and their ongoing treatments.
    - Review uploaded prescriptions and lab reports.
    - Track patient history and visit records.
  - **Nurse View:**
    - Upload prescriptions and lab reports for each patient visit.
    - Track and record payments (cash/online).
    - Schedule next appointments and set reminders.
    - Manage patient records and notes.

---

### 3. Data Flow
- **Database:** MongoDB Atlas
  - Stores patient profiles, visit records, prescriptions, reports, payments, and reminders.
- **File Storage:** Cloudinary
  - Stores prescription images (not reports).
- **AI Integration:** Gemini API
  - Analyzes lab reports and extracts key values for doctor review.
- **Reminders:**
  - Scheduled via GitHub Actions, triggers API to send SMS reminders using Twilio.

---

### 4. Security & Auth
- **Authentication:** JWT-based login for doctors and nurses.
- **Environment Variables:** Used for sensitive keys (MongoDB, Twilio, Gemini, Cloudinary).

---

### 5. Deployment
- **Frontend & API:** Deployed on Vercel as a Next.js app.
- **Serverless Functions:** API routes for all backend logic (booking, uploads, reminders).

---

## Summary
- **Patient Portal:** Appointment booking, record access.
- **Doctor/Nurse Dashboard:** Patient management, uploads, payments, reminders.
- **Database:** MongoDB Atlas
- **File Storage:** Cloudinary (prescriptions)
- **AI Analysis:** Gemini API (lab reports)
- **Reminders:** GitHub Actions + Twilio
- **Deployment:** Vercel

---

For more details, see the codebase structure and API route documentation.
