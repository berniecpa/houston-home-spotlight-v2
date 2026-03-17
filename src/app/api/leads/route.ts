/**
 * Leads API Route
 * 
 * Handles POST requests to submit lead form data to Perfex CRM.
 * Maps form fields to Perfex CRM API expectations.
 * 
 * @module app/api/leads/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { LeadFormData, LeadSubmissionResponse } from '@/types';

/**
 * POST handler for lead submission
 * 
 * @param {NextRequest} request - The incoming request with lead form data
 * @returns {Promise<NextResponse<LeadSubmissionResponse>>} API response
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadSubmissionResponse>> {
  try {
    // Parse request body
    const body: LeadFormData = await request.json();

    // Validate required fields
    const requiredFields: (keyof LeadFormData)[] = ['firstname', 'lastname', 'email', 'phonenumber'];
    const missingFields = requiredFields.filter(field => !body[field] || String(body[field]).trim() === '');
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email format'
        },
        { status: 400 }
      );
    }

    // Get environment variables for Perfex CRM
    const perfexUrl = process.env.PERFEX_RE_URL;
    const perfexKey = process.env.PERFEX_RE_KEY;

    // If Perfex CRM credentials are configured, submit to CRM
    if (perfexUrl && perfexKey) {
      try {
        const crmResponse = await fetch(`${perfexUrl}/api/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perfexKey}`
          },
          body: JSON.stringify({
            firstname: body.firstname,
            lastname: body.lastname,
            email: body.email,
            phonenumber: body.phonenumber,
            description: body.description || '',
            // Add source tracking
            source: 'Houston Home Spotlight Website',
            custom_fields: body.listingSlug 
              ? [{ name: 'Listing Slug', value: body.listingSlug }]
              : undefined
          })
        });

        if (!crmResponse.ok) {
          console.error('Perfex CRM submission failed:', await crmResponse.text());
          // Continue to return success to user even if CRM fails
          // We don't want to lose the lead due to CRM issues
        }
      } catch (crmError) {
        console.error('Error submitting to Perfex CRM:', crmError);
        // Continue - don't fail the user request due to CRM issues
      }
    }

    // Log lead submission (for debugging/monitoring)
    console.log('Lead submitted:', {
      name: `${body.firstname} ${body.lastname}`,
      email: body.email,
      listingSlug: body.listingSlug || 'general inquiry',
      timestamp: new Date().toISOString()
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Your inquiry has been submitted. We will contact you soon.',
        leadId: `lead_${Date.now()}`
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing lead submission:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while processing your request. Please try again.'
      },
      { status: 500 }
    );
  }
}
