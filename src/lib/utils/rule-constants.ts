/** Shared operator definitions for rule conditions */
export const RULE_OPERATORS = [
  { value: 'contains', label: '含む' },
  { value: 'not_contains', label: '含まない' },
  { value: 'equals', label: '等しい' },
  { value: 'not_equals', label: '等しくない' },
  { value: 'gt', label: 'より大きい' },
  { value: 'gte', label: '以上' },
  { value: 'lt', label: 'より小さい' },
  { value: 'lte', label: '以下' },
] as const

/** Shared field definitions for rule conditions */
export const RULE_FIELDS = [
  { value: 'reason', label: 'アクション名 (reason)' },
  { value: 'metadata.amount', label: '金額 (metadata.amount)' },
  { value: 'metadata.recipient_count', label: '受信者数 (metadata.recipient_count)' },
  { value: 'metadata.operation_type', label: '操作種別 (metadata.operation_type)' },
] as const
