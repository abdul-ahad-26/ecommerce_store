/**
 * Real customer testimonials shown on the home page.
 *
 * Intentionally EMPTY by default — the home "What our customers say" section
 * only renders when this array has entries, so no fabricated reviews ever ship.
 * Add genuine quotes here (with permission) to enable the section, e.g.:
 *
 *   { quote: "The lawn quality is beautiful…", name: "Hira A.", city: "Lahore" },
 */
export interface Testimonial {
  quote: string;
  name: string;
  city: string;
}

export const TESTIMONIALS: Testimonial[] = [];
