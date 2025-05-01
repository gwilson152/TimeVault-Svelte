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
 * Convert minutes to hours for display
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
  const match = formatted.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, hours, minutes] = match;
  return parseInt(hours) * 60 + parseInt(minutes);
}

/**
 * Convert minutes to HH:MM format
 * @param minutes Time in minutes
 * @returns Time in HH:MM format
 */
export function minutesToFormatted(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}`;
}

/**
 * Calculate duration in minutes between two dates
 * @param start Start date/time
 * @param end End date/time
 * @returns Duration in minutes
 */
export function calculateDurationInMinutes(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60)); // Convert ms to minutes
}

/**
 * Calculate end time from start time and minutes
 * @param start Start date/time
 * @param minutes Duration in minutes
 * @returns End date/time
 */
export function calculateEndTime(start: Date, minutes: number): Date {
  const end = new Date(start);
  end.setTime(end.getTime() + (minutes * 60 * 1000));
  return end;
}

/**
 * Format a Date object or time string to display time in 24h format (HH:MM)
 * @param date A Date object or string to format
 * @returns Formatted time string in 24h format (HH:MM)
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}