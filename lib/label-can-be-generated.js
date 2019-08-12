/**
 * checks if the order has all the properties necessary to buy the label on the melhor-envio.
 */
module.exports = order => {
  if (order.hasOwnProperty('fulfillment_status') && order.fulfillment_status.hasOwnProperty('current')) {
    switch (order.fulfillment_status.current) {
      // the tag can only be generated if the fulfillment_status.current equals ready_for_shipping
      case 'ready_for_shipping':
        // if the order is ready for shipment
        // checks if the shipping service is the melhor-envio.
        let shippingService = order.shipping_lines.find(shipping => shipping.hasOwnProperty('app') && shipping.app.service_code.startsWith('ME'))

        if (shippingService) {
          // checks if the order already has a invoices and NF number.
          if (shippingService.hasOwnProperty('invoices') && shippingService.invoices[0].hasOwnProperty('issuer') && shippingService.invoices[0].issuer.hasOwnProperty('doc_number')) {
            if (order.hasOwnProperty('hidden_metafields')) {
              // checks if the order already has a generated tag
              let label = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')
              return !(label)
            }
            return true
          }
        }

        break
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
  return false
}
