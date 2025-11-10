/**
 * Shared helper functions for Brevo contact management
 */

/**
 * Adds or updates a contact in Brevo with their name and location
 * Non-blocking: errors are logged but don't interrupt the main flow
 */
export async function addContactToBrevo(
  email: string,
  name: string,
  location: "Florida" | "California" | "Other"
): Promise<void> {
  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  const brevoListId = Deno.env.get('BREVO_LIST_ID');
  
  if (!brevoApiKey || !brevoListId) {
    console.warn('[Brevo] API key or List ID not configured, skipping contact sync');
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify({
        email,
        attributes: {
          FIRSTNAME: name,
          LOCATION: location
        },
        listIds: [parseInt(brevoListId)],
        updateEnabled: true // Update if contact already exists
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Brevo] Failed to add contact:', error);
    } else {
      console.log(`[Brevo] Contact ${email} added/updated with location: ${location}`);
    }
  } catch (error) {
    console.error('[Brevo] Error adding contact:', error);
    // Don't throw - we don't want Brevo failures to affect attendee creation
  }
}

/**
 * Determines event location based on venue address
 * Returns "Florida", "California", or "Other"
 */
export function determineLocationFromVenue(venue: any): "Florida" | "California" | "Other" {
  if (!venue?.address) {
    console.log('[Brevo] No venue address found, defaulting to "Other"');
    return "Other";
  }
  
  const address = venue.address.toLowerCase();
  
  if (address.includes('florida') || address.includes(', fl') || address.includes(' fl ')) {
    console.log(`[Brevo] Detected Florida location from: ${venue.address}`);
    return "Florida";
  }
  
  if (address.includes('california') || address.includes(', ca') || address.includes(' ca ')) {
    console.log(`[Brevo] Detected California location from: ${venue.address}`);
    return "California";
  }
  
  console.log(`[Brevo] Could not detect location from: ${venue.address}, using "Other"`);
  return "Other";
}
