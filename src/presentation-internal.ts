/** Runtime-only payment advice values; never document-authored or publicly injectable. */
export interface ResolvedPaymentAdvice {
  title: string
  content?: string
  number: string
  dueDate?: string
  customer: string
  amountDue: number
}
