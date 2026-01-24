export const PAYSTACK_PLAN_CODES = {
  base: {
    starter: {
      monthly: "starter_monthly",
      yearly: "starter_yearly",
    },
    pro: {
      monthly: "pro_monthly",
      yearly: "pro_yearly",
    },
    agency: {
      monthly: "agency_monthly",
      yearly: "agency_yearly",
    },
  },
  seats: {
    starter: {
      monthly: "starter_seat_monthly",
      yearly: "starter_seat_yearly",
    },
    pro: {
      monthly: "pro_seat_monthly",
      yearly: "pro_seat_yearly",
    },
    agency: {
      monthly: "agency_seat_monthly",
      yearly: "agency_seat_yearly",
    },
  },
} as const;
