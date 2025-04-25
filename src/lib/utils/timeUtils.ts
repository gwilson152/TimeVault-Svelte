/**
 * Utility functions for time entry handling and conversions
 */

/**
 * Convert decimal hours to minutes
 * @param hours Time in decimal hours
 * @returns Time in minutes (rounded to nearest minute)
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/**
 * Convert minutes to decimal hours
 * @param minutes Time in minutes
 * @returns Time in decimal hours
 */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

/**
 * Convert decimal hours to HH:MM format
 * @param hours Time in decimal hours
 * @returns Time in HH:MM format
 */
export function hoursToFormatted(hours: number): string {
  const totalMinutes = hoursToMinutes(hours);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM format to decimal hours
 * @param formatted Time in HH:MM format
 * @returns Time in decimal hours, or null if invalid format
 */
export function formattedToHours(formatted: string): number | null {
  const match = formatted.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (minutes >= 60) return null;
  
  return hours + (minutes / 60);
}

/**
 * Convert HH:MM format to minutes
 * @param formatted Time in HH:MM format
 * @returns Time in minutes, or null if invalid format
 */
export function formattedToMinutes(formatted: string): number | null {
  const hours = formattedToHours(formatted);
  return hours !== null ? hoursToMinutes(hours) : null;
}

/**
 * Convert minutes to HH:MM format
 * @param minutes Time in minutes
 * @returns Time in HH:MM format
 */
export function minutesToFormatted(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}