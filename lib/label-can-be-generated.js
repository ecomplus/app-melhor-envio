module.exports = order => {
  if (order.hasOwnProperty('fulfillment_status') && order.fulfillment_status.hasOwnProperty('current')) {
    switch (order.fulfillment_status.current) {
      // quando a order está com
      // o status ready_for_shipping
      // está pronta pra gerar a etiqueta
      case 'ready_for_shipping':
        // verifica se o serviço
        // de envio começa com ME
        let shippingService = order.shipping_lines.find(shipping => shipping.hasOwnProperty('app') && shipping.app.service_code.startsWith('ME'))
        // se for o melhor envio
        if (shippingService) {
          // verifica se a order tem
          // as propriedades invoice
          if (shippingService.hasOwnProperty('invoices') && shippingService.invoices[0].hasOwnProperty('issuer') && shippingService.invoices[0].issuer.hasOwnProperty('doc_number')) {
            // se houver
            // os documentos fiscais da order
            // foram emitidos
            if (order.hasOwnProperty('hidden_metafields')) {
              // então verifico se já existe
              // hidden_metafields
              let label = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')
              // se houver e for
              // houver etiqueta já comprada
              // retorna falso
              return !(label)
            }
            // se não houver etiqueta gerada
            return true
          }
        }
        break
      // se houver outro status diferente de ready_for_shipping
      // a rotina do app atualizará o status do etiqueta na order
      case 'invoice_issued':
      case 'in_production':
      case 'in_separation':
      case 'partially_shippend':
      case 'shipped':
      case 'partially_delivered':
      case 'returned_for_exchange':
      case 'received_for_exchange':
      case 'returned':
        return false
      default: break
    }
  }
  // order não tem propriedades obrigatórias
  // não está pronta para gerar a etiqueta
  return false
}
