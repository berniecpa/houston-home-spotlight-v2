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
        // Build description with listing reference if available
        let description = body.description || '';
        if (body.listingSlug) {
          description = `[Listing: ${body.listingSlug}] ${description}`;
        }

        // Map fields to Perfex CRM format
        const crmPayload = {
          firstname: body.firstname,
          lastname: body.lastname,
          email: body.email,
          phonenumber: body.phonenumber,
          description: description,
          source: 'Houston Home Spotlight Website'
        };

        // Call Perfex CRM API v1 endpoint
        const crmResponse = await fetch(`${perfexUrl}/api/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authtoken': perfexKey
          },
          body: JSON.stringify(crmPayload)
        });

        if (!crmResponse.ok) {
          const errorText = await crmResponse.text();
          console.error('Perfex CRM submission failed:', errorText);
          return NextResponse.json(
            {
              success: false,
              message: 'Failed to submit lead to CRM. Please try again later.'
            },
            { status: 500 }
          );
        }

        const crmData = await crmResponse.json();

        // Return success response with CRM lead ID if available
        return NextResponse.json(
          {
            success: true,
            message: 'Thank you! Your inquiry has been submitted. We will contact you soon.',
            leadId: crmData.id || crmData.lead_id || `lead_${Date.now()}`
          },
          { status: 200 }
        );

      } catch (crmError) {
        console.error('Error submitting to Perfex CRM:', crmError);
        return NextResponse.json(
          {
            success: false,
            message: 'An error occurred while submitting your inquiry. Please try again.'
          },
          { status: 500 }
        );
      }
    } else {
      // CRM not configured - log and return success (for development/testing)
      console.log('Perfex CRM not configured - lead logged only:', {
        name: `${body.firstname} ${body.lastname}`,
        email: body.email,
        listingSlug: body.listingSlug || 'general inquiry',
        timestamp: new Date().toISOString()
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Thank you! Your inquiry has been submitted. We will contact you soon.',
          leadId: `lead_${Date.now()}`
        },
        { status: 200 }
      );
    }

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
