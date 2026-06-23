# Marié UX/UI Audit - 2026-06-23

## Scope

- Evidence folder: `audits/ux-2026-06-23`
- Local server: `http://localhost:3002`
- Checked surfaces: home, jobs list, directory list, login, authenticated mypage, hiring dashboard.
- Evidence limit: screenshots and browser/runtime observations only. Full accessibility compliance, production CDN behavior, and real-user performance were not measured.

## Captured Steps

1. `01-home-desktop.png` / `04b-home-mobile-cdp.png` - Home first viewport: generally clear search-led entry, but broken featured-job image and cramped mobile category label.
2. `02-jobs-desktop.png` / `05b-jobs-mobile-cdp.png` - Jobs list: dense, useful controls, but broken thumbnails and weak mobile scanability.
3. `03-directory-desktop.png` / `06b-directory-mobile-cdp.png` - Directory list: stable grid, but image-less cards let empty gray thumbnails dominate over trust information.
4. `07b-login-mobile-cdp.png` - Login: usable, but large vertical centering makes the first meaningful content start late on mobile.
5. `09-mypage-desktop-auth.png` / `11-mypage-mobile-auth.png` - Authenticated mypage: important trust/completeness content is present, but some mobile trust-row CTAs clip and the mobile active nav label is ambiguous.
6. `10-mypage-dashboard-desktop-auth.png` - Hiring dashboard: visually strong, but total views dominate over action-oriented work such as pending review/backlog.

## Highest-Priority Findings

1. Development overlay shows `3 errors` on authenticated mypage/dashboard.
   - Evidence: `09-mypage-desktop-auth.png`, `10-mypage-dashboard-desktop-auth.png`.
   - Runtime evidence: React hydration mismatch, including `Expected server HTML to contain a matching <a> in <div>` and Suspense boundary client-render fallback.
   - User impact: even if production hides the dev overlay, hydration fallback can delay interactivity and cause layout/content swaps after load.

2. Job/profile images fail visibly instead of falling back.
   - Evidence: `01-home-desktop.png`, `02-jobs-desktop.png`, `04b-home-mobile-cdp.png`, `05b-jobs-mobile-cdp.png`.
   - Likely source: `FeaturedJobsCarousel`, `JobListRow`, and `JobCard` render `<img>` whenever a DB path exists, but do not handle failed public object loads.
   - User impact: broken image icons read as untrusted or unfinished marketplace inventory.

3. Mobile jobs list loses comparison value.
   - Evidence: `05b-jobs-mobile-cdp.png`.
   - The verification badge can wrap vertically, title/company/region are heavily truncated, and the right-side status/CTA competes with core job details.
   - User impact: users cannot quickly compare job title, employer, pay, location, deadline, and trust state.

4. Mypage mobile trust rows clip their CTAs.
   - Evidence: `11-mypage-mobile-auth.png`.
   - Source: `VerificationStatusPanel` uses one horizontal flex row with shrink-0 CTA links.
   - User impact: trust recovery actions are visible but partly unreadable/tough to tap.

5. Mypage first screen has duplicate/competing metrics.
   - Evidence: `09-mypage-desktop-auth.png`, `11-mypage-mobile-auth.png`.
   - The page shows top stats, then profile, then trust/completeness, then additional workspace metrics and tabs lower down.
   - User impact: users see "registered jobs / received applications / completed" before profile risk/completeness, while the next best action is often fixing phone/profile/portfolio.

6. Hiring dashboard prioritizes vanity metric over work queue.
   - Evidence: `10-mypage-dashboard-desktop-auth.png`.
   - Total views gets a huge dark hero while "review needed" is a smaller KPI.
   - User impact: employers may miss the operational question: "Who needs a response now?"

7. Directory cards over-weight empty thumbnails.
   - Evidence: `03-directory-desktop.png`, `06b-directory-mobile-cdp.png`.
   - Image-less profiles devote about half the card to a gray initial; trust data lives below in small type.
   - User impact: cards look visually consistent but not decision-efficient.

8. Mypage and home data fetching can block too much at first render.
   - Evidence from code: `/mypage` loads profile, jobs, posts, sent applications, received applications, portfolios, auth user, pending reviews, bookmarks, and recommendations before/around first render. Home loads posts, jobs, profiles, events, counts, featured jobs, and banner.
   - User impact: below-the-fold recommendations/bookmarks/recent sections can slow the first useful mypage view.

## Recommendations

1. Fix the hydration mismatch before UI polish. Search for invalid/nondeterministic anchor structure around mypage tab rows, rail/header client state, and Suspense boundaries.
2. Add robust image fallback for job/profile images with `onError` state or a shared image component, not just "no path" fallback.
3. Rework mobile job rows into two lines of prioritized data: title + D-day, employer/trust, pay/location, then secondary CTA.
4. Make trust status rows stack on small screens: text first, CTA full-width or next line.
5. On `/mypage`, move "things to fix/respond to" above repeated summary metrics: trust gaps, profile completion, pending applications/reviews.
6. On `/mypage/dashboard`, lead with pending/reviewing applications and response backlog; keep total views as secondary.
7. For directory cards without images, reduce thumbnail height or turn the initial into a compact avatar so trust stats move upward.
8. Put below-the-fold mypage modules behind Suspense boundaries or client/lazy fetch so the profile/trust area can render first.
