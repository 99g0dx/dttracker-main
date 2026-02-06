/**
 * Input validation utilities
 * Provides validation functions for common input types
 */

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const normalized = url.trim();
    // Add https:// if missing
    const urlToTest = normalized.startsWith("http://") || normalized.startsWith("https://")
      ? normalized
      : `https://${normalized}`;
    
    const urlObj = new URL(urlToTest);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number (basic validation)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  
  // Check if it's all digits and has reasonable length (7-15 digits)
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Validate handle/username format
 */
export function isValidHandle(handle: string): boolean {
  if (!handle || typeof handle !== "string") {
    return false;
  }

  const trimmed = handle.trim();
  
  // Basic validation: 1-30 characters, alphanumeric, underscore, dot, hyphen
  // Must start with letter or number
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,29}$/.test(trimmed);
}

/**
 * Validate numeric input
 */
export function isValidNumber(value: string | number, min?: number, max?: number): boolean {
  const num = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(num) || !isFinite(num)) {
    return false;
  }

  if (min !== undefined && num < min) {
    return false;
  }

  if (max !== undefined && num > max) {
    return false;
  }

  return true;
}

/**
 * Validate string length
 */
export function isValidLength(
  value: string,
  minLength?: number,
  maxLength?: number
): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const length = value.trim().length;

  if (minLength !== undefined && length < minLength) {
    return false;
  }

  if (maxLength !== undefined && length > maxLength) {
    return false;
  }

  return true;
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  // Remove null bytes and control characters
  return input
    .replace(/\0/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Optional: special character requirement
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push("Password must contain at least one special character");
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate social media URL
 */
export function isValidSocialMediaUrl(url: string): {
  valid: boolean;
  platform?: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
  error?: string;
} {
  if (!isValidUrl(url)) {
    return { valid: false, error: "Invalid URL format" };
  }

  try {
    const normalized = url.trim();
    const urlToTest = normalized.startsWith("http://") || normalized.startsWith("https://")
      ? normalized
      : `https://${normalized}`;
    
    const urlObj = new URL(urlToTest);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes("tiktok.com")) {
      return { valid: true, platform: "tiktok" };
    }
    if (hostname.includes("instagram.com")) {
      return { valid: true, platform: "instagram" };
    }
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return { valid: true, platform: "youtube" };
    }
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return { valid: true, platform: "twitter" };
    }
    if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
      return { valid: true, platform: "facebook" };
    }

    return {
      valid: false,
      error: "Unsupported platform. Please use TikTok, Instagram, YouTube, Twitter, or Facebook.",
    };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Validate file type
 */
export function isValidFileType(
  file: File,
  allowedTypes: string[]
): boolean {
  if (!file || !allowedTypes || allowedTypes.length === 0) {
    return false;
  }

  return allowedTypes.some((type) => {
    if (type.includes("*")) {
      // Handle wildcard types like "image/*"
      const baseType = type.split("/")[0];
      return file.type.startsWith(`${baseType}/`);
    }
    return file.type === type;
  });
}

/**
 * Validate file size
 */
export function isValidFileSize(file: File, maxSizeBytes: number): boolean {
  if (!file || !maxSizeBytes) {
    return false;
  }

  return file.size <= maxSizeBytes;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
