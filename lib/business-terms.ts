export interface BusinessTermsPreset {
  id: string;
  label: string;
  defaultPiiLimit: number;
  piiKey: string;
  contractKey: string;
  invoicingKey: string;
  piiTemplate: string;
  contractTemplate: string;
  invoicingTemplate: string;
}

export const BUSINESS_TERMS_PRESETS: BusinessTermsPreset[] = [
  {
    id: 'ace',
    label: 'ACE Short Form (Default)',
    defaultPiiLimit: 100000,
    piiKey: 'TERMS_PII_ACE',
    contractKey: 'TERMS_ACE',
    invoicingKey: 'TERMS_INVOICING',
    piiTemplate:
      'We propose to offer professional indemnity insurance to the value of £{pii_limit} in the aggregate for this project. If a higher level of PII is required, this will need to be agreed prior to commencement of the works.',
    contractTemplate:
      'This proposal is based on the ACE Short Form Agreement 2015 (unamended) with an aggregate limit to liability equal to the extent of professional indemnity insurance offered. Should other terms of business be proposed, this may affect the fees quoted in this letter and until such point where alternative contract terms are agreed in writing and signed by both parties, this fee proposal and the ACE Short Form Agreement remain in place. Our standard period of liability following completion of the works is 5 years. Should alternative terms of business be proposed, a charge of £1,500{vat_text} for external review of the terms is required.',
    invoicingTemplate:
      'Invoices will be issued on a monthly basis to reflect the work completed. Our standard terms are for payment to be received in our bank account within 30 days of the date our invoice is issued.',
  },
  {
    id: 'winvic',
    label: 'Winvic (£5m PII)',
    defaultPiiLimit: 5000000,
    piiKey: 'TERMS_PII_WINVIC',
    contractKey: 'TERMS_WINVIC',
    invoicingKey: 'TERMS_INVOICING_WINVIC',
    piiTemplate:
      'We propose to offer professional indemnity insurance to the value of £{pii_limit} in the aggregate for this project.',
    contractTemplate:
      'This proposal is based on the existing contractual agreement terms. If Collateral Warranties or any other bespoke client agreements are proposed to be included, a charge of £1,500{vat_text} for external review of the terms is required.',
    invoicingTemplate:
      'Invoices will be issued on the completion of the reports/deliverables or on a monthly basis for the construction stage. Our standard terms are for payment to be received in our bank account within 30 days of the date our invoice is issued.',
  },
];

export function getBusinessTermsPreset(id?: string): BusinessTermsPreset {
  const key = (id || 'ace').trim().toLowerCase();
  return BUSINESS_TERMS_PRESETS.find((p) => p.id === key) ?? BUSINESS_TERMS_PRESETS[0];
}

export function formatTermsPreview(template: string, piiLimit: number, vatApplies: boolean): string {
  const piiFormatted = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(piiLimit || 0);
  const vatText = vatApplies ? '+VAT' : '';
  return template.replace(/\{pii_limit\}/g, piiFormatted).replace(/\{vat_text\}/g, vatText);
}
