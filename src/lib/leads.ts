/**
 * Lead delivery helpers — best-effort Resend email and Perfex CRM post.
 *
 * Both helpers are designed for use with Promise.allSettled: they catch and
 * log their own errors and never throw, so a delivery failure cannot alter
 * the buyer's success response.
 *
 * Security: RESEND_API_KEY is read from the Workers env only; it is never
 * logged, never returned to the client (T-04-13).
 *
 * @module lib/leads
 */

/**
 * Parameters for sendLeadEmail
 */
interface SendLeadEmailParams {
  /** RESEND_API_KEY from Workers env — never log or expose */
  resendKey: string;
  /** Verified sending domain address, e.g. leads@houstonhomespotlight.com */
  fromEmail: string;
  /** Listing agent's email address — primary recipient */
  agentEmail: string;
  /** Bernard's CC address from ADMIN_NOTIFY_EMAIL env var */
  adminEmail: string;
  /** Buyer's email — used as reply_to so the agent can reply directly */
  buyerEmail: string;
  /** Full buyer name: `${firstname} ${lastname}` */
  buyerName: string;
  /** Listing street address for the email subject and body */
  listingAddress: string;
  /** Listing slug for the link back to the listing detail page */
  listingSlug: string;
  /** Buyer's message / inquiry description (may be empty) */
  message: string;
  /** Buyer's phone number */
  phonenumber: string;
}

/**
 * Escape the five HTML-significant characters so buyer-supplied values cannot
 * inject markup (script/img/onerror/anchor phishing) into the notification
 * email body delivered to the agent and Bernard (BL-01 / HTML injection).
 *
 * @param s - Raw, untrusted string
 * @returns HTML-safe string
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip CR/LF (and surrounding whitespace) from a value used in an email
 * header such as the subject line, preventing email-header injection
 * (BL-01). Resend builds headers from these fields, so embedded newlines
 * could otherwise inject additional headers.
 *
 * @param s - Raw, untrusted string destined for a header
 * @returns single-line string with CR/LF removed
 */
function stripNewlines(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Send a lead notification email via Resend REST API.
 *
 * Uses raw fetch — no SDK — for full Cloudflare Workers compatibility.
 * reply_to is set to the buyer's email so the agent can reply directly.
 * Bernard (adminEmail) is CC'd on every inquiry.
 *
 * This helper never throws. On non-2xx, it logs the error and returns.
 * The caller (POST /api/leads) uses Promise.allSettled so the buyer's
 * success response is never blocked by an email failure (LEAD-02, LEAD-03,
 * T-04-14).
 *
 * @param params - Email parameters; all required
 * @returns Promise<void>
 */
export async function sendLeadEmail(params: SendLeadEmailParams): Promise<void> {
  const {
    resendKey,
    fromEmail,
    agentEmail,
    adminEmail,
    buyerEmail,
    buyerName,
    listingAddress,
    listingSlug,
    message,
    phonenumber,
  } = params;

  // Escape every interpolated value before embedding in HTML (BL-01).
  // buyerName/phonenumber/message are buyer-controlled; listingAddress/slug
  // come from D1 but are escaped too for cheap defense-in-depth.
  const safeName = escapeHtml(buyerName);
  const safePhone = escapeHtml(phonenumber);
  const safeMessage = escapeHtml(message || '(no message)');
  const safeAddress = escapeHtml(listingAddress);
  const safeSlug = encodeURIComponent(listingSlug);

  const emailBody = {
    from: fromEmail,
    to: [agentEmail],
    cc: [adminEmail],
    reply_to: buyerEmail,
    // Strip CR/LF so the address can never inject extra email headers (BL-01).
    subject: `New Inquiry: ${stripNewlines(listingAddress)}`,
    html: `
      <p>New inquiry from <strong>${safeName}</strong>
         (<a href="tel:${encodeURIComponent(phonenumber)}">${safePhone}</a>).</p>
      <p><strong>Listing:</strong>
         <a href="https://houstonhomespotlight.com/listings/${safeSlug}">
           ${safeAddress}
         </a>
      </p>
      <p><strong>Message:</strong> ${safeMessage}</p>
      <p>Reply directly to this email to contact the buyer.</p>
    `.trim(),
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify(emailBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend delivery failed:', res.status, errText);
      // Do NOT throw — caller uses Promise.allSettled (T-04-14)
    }
  } catch (err) {
    console.error('sendLeadEmail network error:', err);
    // Do NOT rethrow — caller uses Promise.allSettled (T-04-14)
  }
}

/**
 * Parameters for sendToPerfex — extracted from the existing route.ts logic.
 */
interface SendToPerfexBody {
  firstname: string;
  lastname: string;
  email: string;
  phonenumber: string;
  description?: string;
  listingSlug?: string;
}

/**
 * Env vars needed by sendToPerfex — subset of the Workers env binding.
 */
interface PerfexEnv {
  PERFEX_RE_URL?: string;
  PERFEX_RE_KEY?: string;
}

/**
 * Send a lead to the Perfex CRM API (best-effort).
 *
 * Extracted verbatim from the previous /api/leads route.ts implementation so
 * the existing Perfex integration is preserved in parallel with D1 and Resend.
 * When PERFEX_RE_URL / PERFEX_RE_KEY are not configured the function returns
 * early with a log message (dev / test environment).
 *
 * This helper never throws. On CRM error, it logs and returns.
 * The caller uses Promise.allSettled so a Perfex failure never blocks the
 * buyer's success response (LEAD-04, T-04-14).
 *
 * @param body - Lead form data from the request body
 * @param env  - Workers env object providing PERFEX_RE_URL / PERFEX_RE_KEY
 * @returns Promise<void>
 */
export async function sendToPerfex(
  body: SendToPerfexBody,
  env: PerfexEnv
): Promise<void> {
  const perfexUrl = env.PERFEX_RE_URL;
  const perfexKey = env.PERFEX_RE_KEY;

  if (!perfexUrl || !perfexKey) {
    console.log('Perfex CRM not configured — skipping CRM submission:', {
      name: `${body.firstname} ${body.lastname}`,
      email: body.email,
      listingSlug: body.listingSlug || 'general inquiry',
    });
    return;
  }

  try {
    // Build description with listing reference if available
    let description = body.description || '';
    if (body.listingSlug) {
      description = `[Listing: ${body.listingSlug}] ${description}`;
    }

    const crmPayload = {
      firstname: body.firstname,
      lastname: body.lastname,
      email: body.email,
      phonenumber: body.phonenumber,
      description: description,
      source: 'Houston Home Spotlight Website',
    };

    const crmResponse = await fetch(`${perfexUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': perfexKey,
      },
      body: JSON.stringify(crmPayload),
    });

    if (!crmResponse.ok) {
      const errorText = await crmResponse.text();
      console.error('Perfex CRM submission failed:', errorText);
      // Do NOT throw — caller uses Promise.allSettled (T-04-14)
    }
  } catch (err) {
    console.error('sendToPerfex error:', err);
    // Do NOT rethrow — caller uses Promise.allSettled (T-04-14)
  }
}
