// src/locale.ts — Semantic invoice labels resolved from BCP 47 locale tags.

export type InvoiceDirection = 'ltr' | 'rtl'

export interface InvoiceLabels {
  documentTypes: {
    invoice: string
    quote: string
    credit_note: string
    receipt: string
    estimate: string
  }
  meta: {
    date: string
    due: string
    expires: string
    currency: string
    reference: string
    creditReference: string
  }
  party: {
    from: string
    to: string
    issuedBy: string
    billedTo: string
    attention: string
    taxId: string
    businessNumber: string
  }
  items: {
    description: string
    quantity: string
    unit: string
    unitPrice: string
    discount: string
    tax: string
    amount: string
  }
  totals: {
    summary: string
    subtotal: string
    discount: string
    afterDiscounts: string
    included: string
    withholding: string
    total: string
    prepaid: string
    amountDue: string
  }
  payment: {
    title: string
    beneficiary: string
    bank: string
    routing: string
    account: string
    address: string
    network: string
  }
  paymentAdvice: {
    title: string
    invoiceNumber: string
    dueDate: string
    customer: string
    amountDue: string
    amountEnclosed: string
  }
  pagination: {
    format: string
  }
}

type NestedPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? NestedPartial<T[K]>
    : T[K]
}

const ENGLISH_LABELS: InvoiceLabels = {
  documentTypes: {
    invoice: 'INVOICE',
    quote: 'QUOTE',
    credit_note: 'CREDIT NOTE',
    receipt: 'RECEIPT',
    estimate: 'ESTIMATE',
  },
  meta: {
    date: 'Date',
    due: 'Due',
    expires: 'Expires',
    currency: 'Currency',
    reference: 'Reference',
    creditReference: 'Credit reference',
  },
  party: {
    from: 'From',
    to: 'Bill To',
    issuedBy: 'Issued by',
    billedTo: 'Billed to',
    attention: 'Attn',
    taxId: 'Tax ID',
    businessNumber: 'Business No',
  },
  items: {
    description: 'Description',
    quantity: 'Quantity',
    unit: 'Unit',
    unitPrice: 'Unit Price',
    discount: 'Discount',
    tax: 'Tax',
    amount: 'Amount',
  },
  totals: {
    summary: 'Invoice summary',
    subtotal: 'Subtotal',
    discount: 'Discount',
    afterDiscounts: 'After Discounts',
    included: 'included',
    withholding: 'Withholding',
    total: 'Total',
    prepaid: 'Prepaid',
    amountDue: 'Amount Due',
  },
  payment: {
    title: 'Payment',
    beneficiary: 'Beneficiary',
    bank: 'Bank',
    routing: 'Routing',
    account: 'Account',
    address: 'Address',
    network: 'Network',
  },
  paymentAdvice: {
    title: 'Payment Advice',
    invoiceNumber: 'Invoice number',
    dueDate: 'Due date',
    customer: 'Customer',
    amountDue: 'Amount due',
    amountEnclosed: 'Amount enclosed',
  },
  pagination: {
    format: 'Page {page} of {pages}',
  },
}

function mergeLabels(overrides: NestedPartial<InvoiceLabels>): InvoiceLabels {
  return {
    documentTypes: { ...ENGLISH_LABELS.documentTypes, ...overrides.documentTypes },
    meta: { ...ENGLISH_LABELS.meta, ...overrides.meta },
    party: { ...ENGLISH_LABELS.party, ...overrides.party },
    items: { ...ENGLISH_LABELS.items, ...overrides.items },
    totals: { ...ENGLISH_LABELS.totals, ...overrides.totals },
    payment: { ...ENGLISH_LABELS.payment, ...overrides.payment },
    paymentAdvice: { ...ENGLISH_LABELS.paymentAdvice, ...overrides.paymentAdvice },
    pagination: { ...ENGLISH_LABELS.pagination, ...overrides.pagination },
  }
}

const LABELS: Record<string, InvoiceLabels> = {
  en: ENGLISH_LABELS,
  es: mergeLabels({
    documentTypes: {
      invoice: 'Factura', quote: 'Cotización', credit_note: 'Nota de crédito',
      receipt: 'Recibo', estimate: 'Presupuesto',
    },
    meta: {
      date: 'Fecha', due: 'Vencimiento', expires: 'Válido hasta',
      currency: 'Moneda', reference: 'Referencia', creditReference: 'Factura de referencia',
    },
    party: {
      from: 'Emisor', to: 'Cliente', issuedBy: 'Emitida por', billedTo: 'Facturada a',
      attention: 'Atención', taxId: 'ID fiscal', businessNumber: 'N.º de empresa',
    },
    items: {
      description: 'Descripción', quantity: 'Cantidad', unit: 'Unidad',
      unitPrice: 'Precio unitario', discount: 'Descuento', tax: 'Impuesto', amount: 'Importe',
    },
    totals: {
      summary: 'Resumen de factura', subtotal: 'Subtotal', discount: 'Descuento',
      afterDiscounts: 'Después de descuentos', included: 'incluido',
      withholding: 'Retención', total: 'Total', prepaid: 'Anticipo', amountDue: 'Total a pagar',
    },
    payment: {
      title: 'Pago', beneficiary: 'Beneficiario', bank: 'Banco',
      routing: 'Código bancario', account: 'Cuenta', address: 'Dirección', network: 'Red',
    },
    pagination: { format: 'Página {page} de {pages}' },
  }),
  pt: mergeLabels({
    documentTypes: {
      invoice: 'Fatura', quote: 'Cotação', credit_note: 'Nota de crédito',
      receipt: 'Recibo', estimate: 'Orçamento',
    },
    meta: {
      date: 'Data', due: 'Vencimento', expires: 'Validade',
      currency: 'Moeda', reference: 'Referência', creditReference: 'Fatura de referência',
    },
    party: {
      from: 'Emitente', to: 'Cliente', issuedBy: 'Emitida por', billedTo: 'Faturada para',
      attention: 'Atenção', taxId: 'ID fiscal', businessNumber: 'N.º da empresa',
    },
    items: {
      description: 'Descrição', quantity: 'Quantidade', unit: 'Unidade',
      unitPrice: 'Preço unitário', discount: 'Desconto', tax: 'Imposto', amount: 'Valor',
    },
    totals: {
      summary: 'Resumo da fatura', subtotal: 'Subtotal', discount: 'Desconto',
      afterDiscounts: 'Após descontos', included: 'incluído',
      withholding: 'Retenção', total: 'Total', prepaid: 'Adiantamento', amountDue: 'Valor a pagar',
    },
    payment: {
      title: 'Pagamento', beneficiary: 'Beneficiário', bank: 'Banco',
      routing: 'Código bancário', account: 'Conta', address: 'Endereço', network: 'Rede',
    },
    pagination: { format: 'Página {page} de {pages}' },
  }),
  fr: mergeLabels({
    documentTypes: {
      invoice: 'Facture', quote: 'Devis', credit_note: 'Avoir',
      receipt: 'Reçu', estimate: 'Estimation',
    },
    meta: {
      date: 'Date', due: 'Échéance', expires: 'Valable jusqu’au',
      currency: 'Devise', reference: 'Référence', creditReference: 'Facture de référence',
    },
    party: {
      from: 'Émetteur', to: 'Client', issuedBy: 'Émise par', billedTo: 'Facturée à',
      attention: 'À l’attention de', taxId: 'N° fiscal', businessNumber: 'N° d’entreprise',
    },
    items: {
      description: 'Description', quantity: 'Quantité', unit: 'Unité',
      unitPrice: 'Prix unitaire', discount: 'Remise', tax: 'Taxe', amount: 'Montant',
    },
    totals: {
      summary: 'Récapitulatif', subtotal: 'Sous-total', discount: 'Remise',
      afterDiscounts: 'Après remises', included: 'incluse',
      withholding: 'Retenue', total: 'Total', prepaid: 'Acompte', amountDue: 'Montant dû',
    },
    payment: {
      title: 'Paiement', beneficiary: 'Bénéficiaire', bank: 'Banque',
      routing: 'Code bancaire', account: 'Compte', address: 'Adresse', network: 'Réseau',
    },
    pagination: { format: 'Page {page} sur {pages}' },
  }),
  de: mergeLabels({
    documentTypes: {
      invoice: 'Rechnung', quote: 'Angebot', credit_note: 'Gutschrift',
      receipt: 'Beleg', estimate: 'Kostenvoranschlag',
    },
    meta: {
      date: 'Datum', due: 'Fällig', expires: 'Gültig bis',
      currency: 'Währung', reference: 'Referenz', creditReference: 'Referenzrechnung',
    },
    party: {
      from: 'Aussteller', to: 'Rechnung an', issuedBy: 'Ausgestellt von', billedTo: 'Abgerechnet an',
      attention: 'Z. Hd.', taxId: 'Steuer-ID', businessNumber: 'Unternehmensnr.',
    },
    items: {
      description: 'Beschreibung', quantity: 'Menge', unit: 'Einheit',
      unitPrice: 'Einzelpreis', discount: 'Rabatt', tax: 'Steuer', amount: 'Betrag',
    },
    totals: {
      summary: 'Rechnungsübersicht', subtotal: 'Zwischensumme', discount: 'Rabatt',
      afterDiscounts: 'Nach Rabatten', included: 'enthalten',
      withholding: 'Einbehalt', total: 'Gesamt', prepaid: 'Vorausbezahlt', amountDue: 'Fälliger Betrag',
    },
    payment: {
      title: 'Zahlung', beneficiary: 'Begünstigter', bank: 'Bank',
      routing: 'Bankleitzahl', account: 'Konto', address: 'Adresse', network: 'Netzwerk',
    },
    pagination: { format: 'Seite {page} von {pages}' },
  }),
  it: mergeLabels({
    documentTypes: {
      invoice: 'Fattura', quote: 'Preventivo', credit_note: 'Nota di credito',
      receipt: 'Ricevuta', estimate: 'Stima',
    },
    meta: {
      date: 'Data', due: 'Scadenza', expires: 'Valido fino al',
      currency: 'Valuta', reference: 'Riferimento', creditReference: 'Fattura di riferimento',
    },
    party: {
      from: 'Emittente', to: 'Cliente', issuedBy: 'Emessa da', billedTo: 'Fatturata a',
      attention: 'Alla cortese attenzione', taxId: 'ID fiscale', businessNumber: 'N. impresa',
    },
    items: {
      description: 'Descrizione', quantity: 'Quantità', unit: 'Unità',
      unitPrice: 'Prezzo unitario', discount: 'Sconto', tax: 'Imposta', amount: 'Importo',
    },
    totals: {
      summary: 'Riepilogo fattura', subtotal: 'Subtotale', discount: 'Sconto',
      afterDiscounts: 'Dopo gli sconti', included: 'inclusa',
      withholding: 'Ritenuta', total: 'Totale', prepaid: 'Anticipo', amountDue: 'Importo dovuto',
    },
    payment: {
      title: 'Pagamento', beneficiary: 'Beneficiario', bank: 'Banca',
      routing: 'Codice banca', account: 'Conto', address: 'Indirizzo', network: 'Rete',
    },
    pagination: { format: 'Pagina {page} di {pages}' },
  }),
  nl: mergeLabels({
    documentTypes: {
      invoice: 'Factuur', quote: 'Offerte', credit_note: 'Creditnota',
      receipt: 'Kwitantie', estimate: 'Raming',
    },
    meta: {
      date: 'Datum', due: 'Vervaldatum', expires: 'Geldig tot',
      currency: 'Valuta', reference: 'Referentie', creditReference: 'Referentiefactuur',
    },
    party: {
      from: 'Afzender', to: 'Factuur aan', issuedBy: 'Uitgegeven door', billedTo: 'Gefactureerd aan',
      attention: 'T.a.v.', taxId: 'Fiscaal nummer', businessNumber: 'Bedrijfsnummer',
    },
    items: {
      description: 'Omschrijving', quantity: 'Aantal', unit: 'Eenheid',
      unitPrice: 'Eenheidsprijs', discount: 'Korting', tax: 'Belasting', amount: 'Bedrag',
    },
    totals: {
      summary: 'Factuuroverzicht', subtotal: 'Subtotaal', discount: 'Korting',
      afterDiscounts: 'Na kortingen', included: 'inbegrepen',
      withholding: 'Inhouding', total: 'Totaal', prepaid: 'Vooruitbetaald', amountDue: 'Te betalen',
    },
    payment: {
      title: 'Betaling', beneficiary: 'Begunstigde', bank: 'Bank',
      routing: 'Bankcode', account: 'Rekening', address: 'Adres', network: 'Netwerk',
    },
    pagination: { format: 'Pagina {page} van {pages}' },
  }),
  pl: mergeLabels({
    documentTypes: {
      invoice: 'Faktura', quote: 'Oferta', credit_note: 'Faktura korygująca',
      receipt: 'Paragon', estimate: 'Kosztorys',
    },
    meta: {
      date: 'Data', due: 'Termin płatności', expires: 'Ważne do',
      currency: 'Waluta', reference: 'Numer referencyjny', creditReference: 'Faktura referencyjna',
    },
    party: {
      from: 'Sprzedawca', to: 'Nabywca', issuedBy: 'Wystawiona przez', billedTo: 'Dla',
      attention: 'Do wiadomości', taxId: 'NIP', businessNumber: 'Numer firmy',
    },
    items: {
      description: 'Opis', quantity: 'Ilość', unit: 'Jednostka',
      unitPrice: 'Cena jednostkowa', discount: 'Rabat', tax: 'Podatek', amount: 'Kwota',
    },
    totals: {
      summary: 'Podsumowanie faktury', subtotal: 'Suma częściowa', discount: 'Rabat',
      afterDiscounts: 'Po rabatach', included: 'wliczony',
      withholding: 'Potrącenie', total: 'Razem', prepaid: 'Przedpłata', amountDue: 'Do zapłaty',
    },
    payment: {
      title: 'Płatność', beneficiary: 'Odbiorca', bank: 'Bank',
      routing: 'Kod banku', account: 'Konto', address: 'Adres', network: 'Sieć',
    },
    pagination: { format: 'Strona {page} z {pages}' },
  }),
  tr: mergeLabels({
    documentTypes: {
      invoice: 'Fatura', quote: 'Teklif', credit_note: 'Alacak dekontu',
      receipt: 'Makbuz', estimate: 'Tahmin',
    },
    meta: {
      date: 'Tarih', due: 'Son ödeme', expires: 'Geçerlilik',
      currency: 'Para birimi', reference: 'Referans', creditReference: 'Referans fatura',
    },
    party: {
      from: 'Gönderen', to: 'Fatura edilen', issuedBy: 'Düzenleyen', billedTo: 'Fatura edilen',
      attention: 'İlgili', taxId: 'Vergi No', businessNumber: 'Şirket No',
    },
    items: {
      description: 'Açıklama', quantity: 'Miktar', unit: 'Birim',
      unitPrice: 'Birim fiyat', discount: 'İndirim', tax: 'Vergi', amount: 'Tutar',
    },
    totals: {
      summary: 'Fatura özeti', subtotal: 'Ara toplam', discount: 'İndirim',
      afterDiscounts: 'İndirim sonrası', included: 'dahil',
      withholding: 'Stopaj', total: 'Toplam', prepaid: 'Ön ödeme', amountDue: 'Ödenecek tutar',
    },
    payment: {
      title: 'Ödeme', beneficiary: 'Lehtar', bank: 'Banka',
      routing: 'Banka kodu', account: 'Hesap', address: 'Adres', network: 'Ağ',
    },
    pagination: { format: 'Sayfa {page} / {pages}' },
  }),
  id: mergeLabels({
    documentTypes: {
      invoice: 'Faktur', quote: 'Penawaran', credit_note: 'Nota kredit',
      receipt: 'Kuitansi', estimate: 'Estimasi',
    },
    meta: {
      date: 'Tanggal', due: 'Jatuh tempo', expires: 'Berlaku hingga',
      currency: 'Mata uang', reference: 'Referensi', creditReference: 'Faktur referensi',
    },
    party: {
      from: 'Dari', to: 'Ditagihkan kepada', issuedBy: 'Diterbitkan oleh', billedTo: 'Ditagihkan kepada',
      attention: 'Perhatian', taxId: 'ID pajak', businessNumber: 'Nomor usaha',
    },
    items: {
      description: 'Deskripsi', quantity: 'Jumlah', unit: 'Satuan',
      unitPrice: 'Harga satuan', discount: 'Diskon', tax: 'Pajak', amount: 'Nilai',
    },
    totals: {
      summary: 'Ringkasan faktur', subtotal: 'Subtotal', discount: 'Diskon',
      afterDiscounts: 'Setelah diskon', included: 'termasuk',
      withholding: 'Potongan', total: 'Total', prepaid: 'Prabayar', amountDue: 'Jumlah terutang',
    },
    payment: {
      title: 'Pembayaran', beneficiary: 'Penerima', bank: 'Bank',
      routing: 'Kode bank', account: 'Rekening', address: 'Alamat', network: 'Jaringan',
    },
    pagination: { format: 'Halaman {page} dari {pages}' },
  }),
  th: mergeLabels({
    documentTypes: {
      invoice: 'ใบแจ้งหนี้', quote: 'ใบเสนอราคา', credit_note: 'ใบลดหนี้',
      receipt: 'ใบเสร็จรับเงิน', estimate: 'ประมาณการ',
    },
    meta: {
      date: 'วันที่', due: 'ครบกำหนด', expires: 'ใช้ได้ถึง',
      currency: 'สกุลเงิน', reference: 'อ้างอิง', creditReference: 'ใบแจ้งหนี้อ้างอิง',
    },
    party: {
      from: 'ผู้ออก', to: 'เรียกเก็บเงินถึง', issuedBy: 'ออกโดย', billedTo: 'เรียกเก็บเงินถึง',
      attention: 'เรียน', taxId: 'เลขประจำตัวผู้เสียภาษี', businessNumber: 'เลขทะเบียนบริษัท',
    },
    items: {
      description: 'รายละเอียด', quantity: 'จำนวน', unit: 'หน่วย',
      unitPrice: 'ราคาต่อหน่วย', discount: 'ส่วนลด', tax: 'ภาษี', amount: 'จำนวนเงิน',
    },
    totals: {
      summary: 'สรุปใบแจ้งหนี้', subtotal: 'ยอดรวมย่อย', discount: 'ส่วนลด',
      afterDiscounts: 'หลังหักส่วนลด', included: 'รวมแล้ว',
      withholding: 'หัก ณ ที่จ่าย', total: 'ยอดรวม', prepaid: 'ชำระล่วงหน้า', amountDue: 'ยอดที่ต้องชำระ',
    },
    payment: {
      title: 'การชำระเงิน', beneficiary: 'ผู้รับผลประโยชน์', bank: 'ธนาคาร',
      routing: 'รหัสธนาคาร', account: 'บัญชี', address: 'ที่อยู่', network: 'เครือข่าย',
    },
    pagination: { format: 'หน้า {page} จาก {pages}' },
  }),
  vi: mergeLabels({
    documentTypes: {
      invoice: 'Hóa đơn', quote: 'Báo giá', credit_note: 'Phiếu ghi có',
      receipt: 'Biên lai', estimate: 'Dự toán',
    },
    meta: {
      date: 'Ngày', due: 'Hạn thanh toán', expires: 'Có hiệu lực đến',
      currency: 'Tiền tệ', reference: 'Tham chiếu', creditReference: 'Hóa đơn tham chiếu',
    },
    party: {
      from: 'Bên phát hành', to: 'Khách hàng', issuedBy: 'Phát hành bởi', billedTo: 'Lập hóa đơn cho',
      attention: 'Người nhận', taxId: 'Mã số thuế', businessNumber: 'Mã doanh nghiệp',
    },
    items: {
      description: 'Mô tả', quantity: 'Số lượng', unit: 'Đơn vị',
      unitPrice: 'Đơn giá', discount: 'Chiết khấu', tax: 'Thuế', amount: 'Thành tiền',
    },
    totals: {
      summary: 'Tóm tắt hóa đơn', subtotal: 'Tạm tính', discount: 'Chiết khấu',
      afterDiscounts: 'Sau chiết khấu', included: 'đã bao gồm',
      withholding: 'Khấu trừ', total: 'Tổng cộng', prepaid: 'Đã trả trước', amountDue: 'Số tiền phải trả',
    },
    payment: {
      title: 'Thanh toán', beneficiary: 'Người thụ hưởng', bank: 'Ngân hàng',
      routing: 'Mã ngân hàng', account: 'Tài khoản', address: 'Địa chỉ', network: 'Mạng',
    },
    pagination: { format: 'Trang {page} / {pages}' },
  }),
  ja: mergeLabels({
    documentTypes: {
      invoice: '請求書', quote: '見積書', credit_note: 'クレジットノート',
      receipt: '領収書', estimate: '概算書',
    },
    meta: {
      date: '発行日', due: '支払期限', expires: '有効期限',
      currency: '通貨', reference: '参照番号', creditReference: '参照請求書',
    },
    party: {
      from: '発行元', to: '請求先', issuedBy: '発行者', billedTo: '請求先',
      attention: 'ご担当者', taxId: '税務番号', businessNumber: '法人番号',
    },
    items: {
      description: '内容', quantity: '数量', unit: '単位',
      unitPrice: '単価', discount: '割引', tax: '税額', amount: '金額',
    },
    totals: {
      summary: '請求概要', subtotal: '小計', discount: '割引',
      afterDiscounts: '割引後', included: '内税',
      withholding: '源泉徴収', total: '合計', prepaid: '前払金', amountDue: 'お支払額',
    },
    payment: {
      title: 'お支払い', beneficiary: '受取人', bank: '銀行',
      routing: '銀行コード', account: '口座', address: '住所', network: 'ネットワーク',
    },
    pagination: { format: '{page} / {pages} ページ' },
  }),
  ko: mergeLabels({
    documentTypes: {
      invoice: '청구서', quote: '견적서', credit_note: '대변표',
      receipt: '영수증', estimate: '예상 견적',
    },
    meta: {
      date: '발행일', due: '지급 기한', expires: '유효 기간',
      currency: '통화', reference: '참조', creditReference: '참조 청구서',
    },
    party: {
      from: '발행자', to: '청구 대상', issuedBy: '발행자', billedTo: '청구 대상',
      attention: '담당자', taxId: '세금 ID', businessNumber: '사업자 번호',
    },
    items: {
      description: '설명', quantity: '수량', unit: '단위',
      unitPrice: '단가', discount: '할인', tax: '세금', amount: '금액',
    },
    totals: {
      summary: '청구서 요약', subtotal: '소계', discount: '할인',
      afterDiscounts: '할인 후', included: '포함',
      withholding: '원천징수', total: '합계', prepaid: '선불', amountDue: '결제 금액',
    },
    payment: {
      title: '결제', beneficiary: '수취인', bank: '은행',
      routing: '은행 코드', account: '계좌', address: '주소', network: '네트워크',
    },
    pagination: { format: '{page} / {pages} 페이지' },
  }),
  'zh-CN': mergeLabels({
    documentTypes: {
      invoice: '发票', quote: '报价单', credit_note: '贷项通知单',
      receipt: '收据', estimate: '估价单',
    },
    meta: {
      date: '日期', due: '到期日', expires: '有效期至',
      currency: '币种', reference: '参考', creditReference: '参考发票',
    },
    party: {
      from: '开票方', to: '收票方', issuedBy: '开具方', billedTo: '收票方',
      attention: '联系人', taxId: '税号', businessNumber: '企业编号',
    },
    items: {
      description: '说明', quantity: '数量', unit: '单位',
      unitPrice: '单价', discount: '折扣', tax: '税额', amount: '金额',
    },
    totals: {
      summary: '发票汇总', subtotal: '小计', discount: '折扣',
      afterDiscounts: '折后金额', included: '已含',
      withholding: '预扣税', total: '合计', prepaid: '预付款', amountDue: '应付金额',
    },
    payment: {
      title: '付款', beneficiary: '收款人', bank: '银行',
      routing: '银行代码', account: '账户', address: '地址', network: '网络',
    },
    pagination: { format: '第 {page} 页，共 {pages} 页' },
  }),
  'zh-TW': mergeLabels({
    documentTypes: {
      invoice: '發票', quote: '報價單', credit_note: '折讓單',
      receipt: '收據', estimate: '估價單',
    },
    meta: {
      date: '日期', due: '到期日', expires: '有效期限',
      currency: '幣別', reference: '參考', creditReference: '參考發票',
    },
    party: {
      from: '開票方', to: '收票方', issuedBy: '開立方', billedTo: '收票方',
      attention: '聯絡人', taxId: '統一編號', businessNumber: '公司編號',
    },
    items: {
      description: '說明', quantity: '數量', unit: '單位',
      unitPrice: '單價', discount: '折扣', tax: '稅額', amount: '金額',
    },
    totals: {
      summary: '發票摘要', subtotal: '小計', discount: '折扣',
      afterDiscounts: '折扣後', included: '已含',
      withholding: '扣繳', total: '總計', prepaid: '預付款', amountDue: '應付金額',
    },
    payment: {
      title: '付款', beneficiary: '受款人', bank: '銀行',
      routing: '銀行代碼', account: '帳戶', address: '地址', network: '網路',
    },
    pagination: { format: '第 {page} 頁，共 {pages} 頁' },
  }),
  ar: mergeLabels({
    documentTypes: {
      invoice: 'فاتورة', quote: 'عرض سعر', credit_note: 'إشعار دائن',
      receipt: 'إيصال', estimate: 'تقدير',
    },
    meta: {
      date: 'التاريخ', due: 'تاريخ الاستحقاق', expires: 'صالح حتى',
      currency: 'العملة', reference: 'المرجع', creditReference: 'الفاتورة المرجعية',
    },
    party: {
      from: 'من', to: 'الفاتورة إلى', issuedBy: 'صادرة عن', billedTo: 'مفوترة إلى',
      attention: 'عناية', taxId: 'الرقم الضريبي', businessNumber: 'رقم المنشأة',
    },
    items: {
      description: 'الوصف', quantity: 'الكمية', unit: 'الوحدة',
      unitPrice: 'سعر الوحدة', discount: 'الخصم', tax: 'الضريبة', amount: 'المبلغ',
    },
    totals: {
      summary: 'ملخص الفاتورة', subtotal: 'المجموع الفرعي', discount: 'الخصم',
      afterDiscounts: 'بعد الخصومات', included: 'مشمولة',
      withholding: 'الاستقطاع', total: 'الإجمالي', prepaid: 'مدفوع مقدماً', amountDue: 'المبلغ المستحق',
    },
    payment: {
      title: 'الدفع', beneficiary: 'المستفيد', bank: 'البنك',
      routing: 'رمز البنك', account: 'الحساب', address: 'العنوان', network: 'الشبكة',
    },
    pagination: { format: 'صفحة {page} من {pages}' },
  }),
  he: mergeLabels({
    documentTypes: {
      invoice: 'חשבונית', quote: 'הצעת מחיר', credit_note: 'חשבונית זיכוי',
      receipt: 'קבלה', estimate: 'אומדן',
    },
    meta: {
      date: 'תאריך', due: 'לתשלום עד', expires: 'בתוקף עד',
      currency: 'מטבע', reference: 'אסמכתה', creditReference: 'חשבונית מקור',
    },
    party: {
      from: 'מאת', to: 'לחיוב', issuedBy: 'הונפקה על ידי', billedTo: 'לחיוב',
      attention: 'לידי', taxId: 'מספר מס', businessNumber: 'מספר חברה',
    },
    items: {
      description: 'תיאור', quantity: 'כמות', unit: 'יחידה',
      unitPrice: 'מחיר יחידה', discount: 'הנחה', tax: 'מס', amount: 'סכום',
    },
    totals: {
      summary: 'סיכום חשבונית', subtotal: 'סכום ביניים', discount: 'הנחה',
      afterDiscounts: 'לאחר הנחות', included: 'כלול',
      withholding: 'ניכוי במקור', total: 'סה״כ', prepaid: 'שולם מראש', amountDue: 'סכום לתשלום',
    },
    payment: {
      title: 'תשלום', beneficiary: 'מוטב', bank: 'בנק',
      routing: 'קוד בנק', account: 'חשבון', address: 'כתובת', network: 'רשת',
    },
    pagination: { format: 'עמוד {page} מתוך {pages}' },
  }),
  hi: mergeLabels({
    documentTypes: {
      invoice: 'चालान', quote: 'कोटेशन', credit_note: 'क्रेडिट नोट',
      receipt: 'रसीद', estimate: 'अनुमान',
    },
    meta: {
      date: 'दिनांक', due: 'देय तिथि', expires: 'वैधता',
      currency: 'मुद्रा', reference: 'संदर्भ', creditReference: 'संदर्भ चालान',
    },
    party: {
      from: 'प्रेषक', to: 'बिल प्राप्तकर्ता', issuedBy: 'जारीकर्ता', billedTo: 'बिल प्राप्तकर्ता',
      attention: 'ध्यानार्थ', taxId: 'कर आईडी', businessNumber: 'व्यवसाय संख्या',
    },
    items: {
      description: 'विवरण', quantity: 'मात्रा', unit: 'इकाई',
      unitPrice: 'इकाई मूल्य', discount: 'छूट', tax: 'कर', amount: 'राशि',
    },
    totals: {
      summary: 'चालान सारांश', subtotal: 'उप-योग', discount: 'छूट',
      afterDiscounts: 'छूट के बाद', included: 'शामिल',
      withholding: 'कटौती', total: 'कुल', prepaid: 'अग्रिम भुगतान', amountDue: 'देय राशि',
    },
    payment: {
      title: 'भुगतान', beneficiary: 'लाभार्थी', bank: 'बैंक',
      routing: 'बैंक कोड', account: 'खाता', address: 'पता', network: 'नेटवर्क',
    },
    pagination: { format: 'पृष्ठ {page} में से {pages}' },
  }),
  ru: mergeLabels({
    documentTypes: {
      invoice: 'Счёт', quote: 'Коммерческое предложение', credit_note: 'Кредит-нота',
      receipt: 'Квитанция', estimate: 'Смета',
    },
    meta: {
      date: 'Дата', due: 'Срок оплаты', expires: 'Действительно до',
      currency: 'Валюта', reference: 'Ссылка', creditReference: 'Исходный счёт',
    },
    party: {
      from: 'Отправитель', to: 'Получатель', issuedBy: 'Выставлен', billedTo: 'Получатель',
      attention: 'Вниманию', taxId: 'ИНН', businessNumber: 'Регистрационный номер',
    },
    items: {
      description: 'Описание', quantity: 'Количество', unit: 'Единица',
      unitPrice: 'Цена за единицу', discount: 'Скидка', tax: 'Налог', amount: 'Сумма',
    },
    totals: {
      summary: 'Итоги счёта', subtotal: 'Подытог', discount: 'Скидка',
      afterDiscounts: 'После скидок', included: 'включён',
      withholding: 'Удержание', total: 'Итого', prepaid: 'Предоплата', amountDue: 'К оплате',
    },
    payment: {
      title: 'Оплата', beneficiary: 'Получатель', bank: 'Банк',
      routing: 'Банковский код', account: 'Счёт', address: 'Адрес', network: 'Сеть',
    },
    pagination: { format: 'Страница {page} из {pages}' },
  }),
}

const PAYMENT_ADVICE_LABELS: Record<string, InvoiceLabels['paymentAdvice']> = {
  en: ENGLISH_LABELS.paymentAdvice,
  es: {
    title: 'Aviso de pago', invoiceNumber: 'Número de factura', dueDate: 'Fecha de vencimiento',
    customer: 'Cliente', amountDue: 'Total a pagar', amountEnclosed: 'Importe adjunto',
  },
  pt: {
    title: 'Aviso de pagamento', invoiceNumber: 'Número da fatura', dueDate: 'Data de vencimento',
    customer: 'Cliente', amountDue: 'Valor a pagar', amountEnclosed: 'Valor anexado',
  },
  fr: {
    title: 'Avis de paiement', invoiceNumber: 'Numéro de facture', dueDate: 'Date d’échéance',
    customer: 'Client', amountDue: 'Montant dû', amountEnclosed: 'Montant joint',
  },
  de: {
    title: 'Zahlungsavis', invoiceNumber: 'Rechnungsnummer', dueDate: 'Fälligkeitsdatum',
    customer: 'Kunde', amountDue: 'Fälliger Betrag', amountEnclosed: 'Beigefügter Betrag',
  },
  it: {
    title: 'Avviso di pagamento', invoiceNumber: 'Numero fattura', dueDate: 'Data di scadenza',
    customer: 'Cliente', amountDue: 'Importo dovuto', amountEnclosed: 'Importo allegato',
  },
  nl: {
    title: 'Betalingsadvies', invoiceNumber: 'Factuurnummer', dueDate: 'Vervaldatum',
    customer: 'Klant', amountDue: 'Te betalen', amountEnclosed: 'Bijgevoegd bedrag',
  },
  pl: {
    title: 'Potwierdzenie płatności', invoiceNumber: 'Numer faktury', dueDate: 'Termin płatności',
    customer: 'Klient', amountDue: 'Do zapłaty', amountEnclosed: 'Załączona kwota',
  },
  tr: {
    title: 'Ödeme bildirimi', invoiceNumber: 'Fatura numarası', dueDate: 'Son ödeme tarihi',
    customer: 'Müşteri', amountDue: 'Ödenecek tutar', amountEnclosed: 'Eklenen tutar',
  },
  id: {
    title: 'Pemberitahuan pembayaran', invoiceNumber: 'Nomor faktur', dueDate: 'Tanggal jatuh tempo',
    customer: 'Pelanggan', amountDue: 'Jumlah terutang', amountEnclosed: 'Jumlah terlampir',
  },
  th: {
    title: 'ใบแจ้งการชำระเงิน', invoiceNumber: 'เลขที่ใบแจ้งหนี้', dueDate: 'วันที่ครบกำหนด',
    customer: 'ลูกค้า', amountDue: 'ยอดที่ต้องชำระ', amountEnclosed: 'จำนวนเงินที่แนบ',
  },
  vi: {
    title: 'Phiếu báo thanh toán', invoiceNumber: 'Số hóa đơn', dueDate: 'Ngày đến hạn',
    customer: 'Khách hàng', amountDue: 'Số tiền phải trả', amountEnclosed: 'Số tiền đính kèm',
  },
  ja: {
    title: '支払通知書', invoiceNumber: '請求書番号', dueDate: '支払期限',
    customer: '顧客', amountDue: 'お支払額', amountEnclosed: '同封金額',
  },
  ko: {
    title: '지급 안내', invoiceNumber: '청구서 번호', dueDate: '지급 기한',
    customer: '고객', amountDue: '결제 금액', amountEnclosed: '동봉 금액',
  },
  'zh-CN': {
    title: '付款通知', invoiceNumber: '发票号码', dueDate: '到期日',
    customer: '客户', amountDue: '应付金额', amountEnclosed: '随附金额',
  },
  'zh-TW': {
    title: '付款通知', invoiceNumber: '發票號碼', dueDate: '到期日',
    customer: '客戶', amountDue: '應付金額', amountEnclosed: '隨附金額',
  },
  ar: {
    title: 'إشعار الدفع', invoiceNumber: 'رقم الفاتورة', dueDate: 'تاريخ الاستحقاق',
    customer: 'العميل', amountDue: 'المبلغ المستحق', amountEnclosed: 'المبلغ المرفق',
  },
  he: {
    title: 'הודעת תשלום', invoiceNumber: 'מספר חשבונית', dueDate: 'תאריך פירעון',
    customer: 'לקוח', amountDue: 'סכום לתשלום', amountEnclosed: 'סכום מצורף',
  },
  hi: {
    title: 'भुगतान सूचना', invoiceNumber: 'चालान संख्या', dueDate: 'देय तिथि',
    customer: 'ग्राहक', amountDue: 'देय राशि', amountEnclosed: 'संलग्न राशि',
  },
  ru: {
    title: 'Платёжное извещение', invoiceNumber: 'Номер счёта', dueDate: 'Срок оплаты',
    customer: 'Клиент', amountDue: 'К оплате', amountEnclosed: 'Приложенная сумма',
  },
}

export const SUPPORTED_INVOICE_LOCALES = Object.freeze(Object.keys(LABELS))

export interface ResolvedInvoiceLocale {
  locale: string
  direction: InvoiceDirection
  labels: InvoiceLabels
}

function resolveLocaleKey(locale?: string): string {
  if (!locale) return 'en'

  const normalized = locale.trim().replaceAll('_', '-')
  const lower = normalized.toLowerCase()

  if (
    lower === 'zh-tw'
    || lower === 'zh-hk'
    || lower === 'zh-hant'
    || lower.includes('-hant')
  ) return 'zh-TW'
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN'

  const language = lower.split('-')[0]
  return Object.prototype.hasOwnProperty.call(LABELS, language) ? language : 'en'
}

export function resolveInvoiceLocale(locale?: string): ResolvedInvoiceLocale {
  const key = resolveLocaleKey(locale)
  return {
    locale: key,
    direction: key === 'ar' || key === 'he' ? 'rtl' : 'ltr',
    labels: {
      ...LABELS[key],
      paymentAdvice: PAYMENT_ADVICE_LABELS[key] ?? ENGLISH_LABELS.paymentAdvice,
    },
  }
}
