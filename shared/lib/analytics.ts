/**
 * Analytics Wrapper (PostHog)
 * 
 * Shared across all instruments
 */

// PostHog integration will be added in Phase 5
// For now, this is a placeholder

export function trackEvent(event: string, properties?: Record<string, any>) {
  // Placeholder - will implement PostHog in Phase 5
  if (typeof window !== 'undefined' && (window as any).posthog) {
    (window as any).posthog.capture(event, properties);
  }
}
