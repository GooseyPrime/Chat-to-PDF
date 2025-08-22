// TypeScript declarations for Stripe pricing table custom elements
declare namespace JSX {
  interface IntrinsicElements {
    'stripe-pricing-table': {
      'pricing-table-id': string;
      'publishable-key': string;
      'customer-session-client-secret'?: string;
      'customer-email'?: string;
      'client-reference-id'?: string;
    };
  }
}