/**
 * Shared validation schemas for edge functions
 * Uses Zod for type-safe runtime validation
 */

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParticipantInput {
  fullName: string;
  email: string;
  phone?: string;
}

export interface AddonInput {
  id: string;
  qty: number;
}

export interface CartInput {
  eventId: string;
  ticketId: string;
  ticketQty: number;
  participants: ParticipantInput[];
  addons?: AddonInput[];
  coupon?: string;
}

/**
 * Validates a UUID string
 */
export function validateUUID(value: string, fieldName: string = 'ID'): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }
  if (!UUID_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
  return value.toLowerCase();
}

/**
 * Sanitizes a string to prevent XSS
 */
export function sanitizeString(value: string, maxLength: number = 255): string {
  if (typeof value !== 'string') {
    throw new Error('Value must be a string');
  }
  
  // Trim and limit length
  let sanitized = value.trim().slice(0, maxLength);
  
  // Remove potentially dangerous HTML tags and script content
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
  
  return sanitized;
}

/**
 * Validates an email address
 */
export function validateEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required and must be a string');
  }
  
  const sanitized = email.trim().toLowerCase().slice(0, 255);
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }
  
  return sanitized;
}

/**
 * Validates a phone number
 */
export function validatePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  if (typeof phone !== 'string') {
    throw new Error('Phone must be a string');
  }
  
  let sanitized = phone.trim().slice(0, 30);
  
  // If empty string after trimming, return undefined
  if (sanitized.length === 0) return undefined;
  
  // Instead of rejecting invalid characters, clean them out gracefully
  sanitized = sanitized.replace(/[^\d\s\-\(\)\+\.x]/gi, '').trim();
  
  if (sanitized.length === 0) return undefined;
  
  return sanitized;
}

/**
 * Validates a participant object
 */
export function validateParticipant(participant: any): ParticipantInput {
  if (!participant || typeof participant !== 'object') {
    throw new Error('Participant must be an object');
  }
  
  return {
    fullName: sanitizeString(participant.fullName, 100),
    email: validateEmail(participant.email),
    phone: validatePhone(participant.phone),
  };
}

/**
 * Validates an addon object
 */
export function validateAddon(addon: any): AddonInput {
  if (!addon || typeof addon !== 'object') {
    throw new Error('Addon must be an object');
  }
  
  const id = validateUUID(addon.id, 'Addon ID');
  const qty = parseInt(addon.qty);
  
  if (isNaN(qty) || qty < 1 || qty > 10) {
    throw new Error('Addon quantity must be between 1 and 10');
  }
  
  return { id, qty };
}

/**
 * Validates the entire cart object
 */
export function validateCart(cart: any): CartInput {
  if (!cart || typeof cart !== 'object') {
    throw new Error('Cart must be an object');
  }
  
  const eventId = validateUUID(cart.eventId, 'Event ID');
  const ticketId = validateUUID(cart.ticketId, 'Ticket ID');
  const ticketQty = parseInt(cart.ticketQty);
  
  if (isNaN(ticketQty) || ticketQty < 1 || ticketQty > 50) {
    throw new Error('Ticket quantity must be between 1 and 50');
  }
  
  if (!Array.isArray(cart.participants)) {
    throw new Error('Participants must be an array');
  }
  
  if (cart.participants.length < 1 || cart.participants.length > 100) {
    throw new Error('Number of participants must be between 1 and 100');
  }
  
  const participants = cart.participants.map((p: any, i: number) => {
    try {
      return validateParticipant(p);
    } catch (err: any) {
      throw new Error(`Participant ${i + 1}: ${err.message}`);
    }
  });
  
  let addons: AddonInput[] | undefined;
  if (cart.addons) {
    if (!Array.isArray(cart.addons)) {
      throw new Error('Addons must be an array');
    }
    if (cart.addons.length > 20) {
      throw new Error('Maximum 20 different addons allowed');
    }
    addons = cart.addons.map((a: any, i: number) => {
      try {
        return validateAddon(a);
      } catch (err: any) {
        throw new Error(`Addon ${i + 1}: ${err.message}`);
      }
    });
  }
  
  // Preserve coupon code if provided (sanitize it)
  const coupon = cart.coupon ? sanitizeString(String(cart.coupon), 50).toUpperCase() : undefined;

  return {
    eventId,
    ticketId,
    ticketQty,
    participants,
    addons,
    coupon,
  };
}

/**
 * Validates coupon code input
 */
export function validateCouponInput(eventId: any, code: any): { eventId: string; code: string } {
  return {
    eventId: validateUUID(eventId, 'Event ID'),
    code: sanitizeString(code, 50).toUpperCase(),
  };
}
