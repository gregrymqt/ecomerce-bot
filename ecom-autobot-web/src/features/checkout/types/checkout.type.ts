export interface AddressSchema {
  zip_code: string;
  street_name: string;
  street_number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
}

export interface PayerIdentificationSchema {
  type: string; // "CPF" | "CNPJ"
  number: string;
}

export interface CustomerInfo {
  email: string;
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
}

export interface OrderItem {
  title: string;
  unit_price: number | string;
  quantity: number;
  description?: string;
  external_code?: string;
  picture_url?: string;
}

export interface CreatePixCheckoutPayload {
  external_reference: string;
  total_amount: number;
  expiration_time_iso?: string;
  customer: CustomerInfo;
  shipping_address?: AddressSchema;
  items: OrderItem[];
}

export interface CreateCreditCardCheckoutPayload {
  external_reference: string;
  total_amount: number;
  payment_method_id: string; // "visa", "master", etc.
  card_token: string;
  installments: number;
  statement_descriptor?: string;
  customer: CustomerInfo;
  items: OrderItem[];
}

export interface CheckoutResultOutput {
  order_id: string;
  mp_order_id: string;
  external_reference: string;
  status: string; // "created", "processed", "action_required", etc.
  status_detail?: string;
  total_amount: number;
  pix_qr_code?: string | null;
  pix_qr_code_base64?: string | null;
  pix_expiration_date?: string | null;
}

export interface OrderDetails {
  id: string;
  tenant_id: string;
  mp_order_id: string;
  external_reference: string;
  status: string;
  status_detail?: string;
  payment_method_type: string;
  total_amount: number;
  total_paid_amount: number;
  payer_email: string;
  pix_qr_code?: string | null;
  pix_qr_code_base64?: string | null;
  pix_expiration_date?: string | null;
  created_at: string;
  updated_at: string;
}