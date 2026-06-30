export type AppBindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export type AppVariables = {
  user: UserPayload;
};

export type UserPayload = {
  email: string;
  id?: number;
  role?: string;
  iat?: number;
  exp?: number;
};


export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}