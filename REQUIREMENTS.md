# Houston Home Spotlight — Home Showcase Site Requirements

## 1. Project Overview

### 1.1 Project Goal
To create a visually stunning, performant, and mobile-first marketing website for Bernard (Houston Home Spotlight) to showcase homes for sale in the Houston area. The primary objective is lead generation: potential buyers browse listings and use a contact form to connect with Bernard. This is a "brochure site with listings," not a complex SaaS application, an internal tool, or a multi-user platform.

### 1.2 Business Context
Bernard is a licensed Realtor in Harris and Fort Bend counties. This site serves as a digital storefront to highlight properties, attract prospective buyers, and facilitate direct inquiries.

### 1.3 Key Differentiators
- **Visual Focus:** High-quality imagery and video are paramount.
- **Simplicity:** Streamlined user experience and minimal administrative overhead.
- **Lead Generation:** Direct and easy contact pathways to Bernard.

## 2. Functional Requirements

### 2.1 Listing Display
- **Featured Listings:** Prominently display a curated selection of homes.
- **Listing Details Page:** Each home needs its own dedicated page.
  - **Photos:** High-resolution image galleries supporting multiple images per listing.
  - **Video:** Embed video tours of the property.
  - **Key Stats:**
    - Address
    - Price
    - Number of Bedrooms (Beds)
    - Number of Bathrooms (Baths)
    - Square Footage (Sqft)
    - Property Highlights/Description: A free-text area for unique selling points.
- **Search/Filtering (Optional, keep simple):** Basic search by address or a few key criteria could be considered if it doesn't add significant complexity. For a v1, a simple curated list is sufficient.

### 2.2 Lead Generation
- **Contact/Inquiry Form:** A clear call-to-action on every listing page and a dedicated Contact page.
  - Fields: Name, Email, Phone Number, Message.
  - Submission: POSTs to Perfex CRM API (Real Estate instance) to create a new lead. Fields map to: Name → contact_firstname/lastname, Email → email, Phone → phone, Message → description, Listing → custom note field.
  - Confirmation: Displays a simple "Thank You" message upon successful submission.

### 2.3 Administrative Functionality
- **Listing Management:** A simple mechanism to add, edit, or remove listings.
  - **Format:** Listings data will be stored as static JSON files or Markdown files.
  - **Process:** Update these files directly in the codebase (e.g., via Git) to reflect changes. No in-browser CMS is required.

## 3. Non-Functional Requirements

### 3.1 Performance
- **Fast Loading:** Pages must load quickly on all devices.
- **Image Optimization:** Images will be optimized for web delivery (e.g., modern formats like WebP, lazy loading, responsive images).

### 3.2 Usability & Accessibility
- **Mobile-First Responsiveness:** The site must be fully responsive and adapt gracefully to various screen sizes (phones, tablets, desktops).
- **Intuitive Navigation:** Easy for users to browse listings and find information.
- **Clear Calls to Action:** Prominent and easily identifiable contact forms.

### 3.3 Security
- **Basic Security:** Given no user accounts or sensitive data storage, standard web security practices for static sites will be followed.

### 3.4 Scalability
- **Low-Cost Hosting:** Leveraging Cloudflare Pages for efficient content delivery.
- **Data Storage:** Static JSON/Markdown files or a lightweight database like Cloudflare D1 for listing data.

## 4. Technical Stack

- **Frontend Framework:** Next.js or Astro (to be confirmed based on ease of static site generation and developer experience).
- **Styling:** Tailwind CSS for rapid and consistent UI development.
- **Deployment:** Cloudflare Pages for global CDN and seamless deployment of static assets.
- **Data Storage:**
  - **Option 1 (Preferred for v1 simplicity):** Static JSON or Markdown files within the repository for listing data.
  - **Option 2 (Future consideration for slightly more dynamic needs):** Cloudflare D1 (SQLite) for structured listing data, if a more API-driven approach becomes necessary.
- **Lead Capture:** Contact form POSTs to Perfex CRM API (Real Estate instance). Uses PERFEX_RE_URL + PERFEX_RE_KEY from environment. No email service needed.

## 5. Out of Scope

- User accounts, authentication, or user dashboards.
- Complex content management system (CMS).
- Multi-tenancy or support for multiple realtors.
- Advanced search functionality (e.g., map integration, school districts).
- Integration with MLS or external listing services (manual data entry for now).
- Blog or dynamic content beyond listings.
- AI-powered features.
- Any features not directly contributing to showcasing homes and generating leads for Bernard.

## 6. Open Questions / Decisions Needed

- Confirmation on Next.js vs. Astro for the frontend framework.
- Perfex CRM API credentials for Real Estate instance (PERFEX_RE_URL, PERFEX_RE_KEY from .env)
- Initial set of listing data (JSON/Markdown content).
