module.exports = (order, appConfig) => {
  if (!order.fulfillment_status || !order.fulfillment_status.current) {
    return false
  }

  // checks if the order already has a generated tag
  if (order.hidden_metafields && order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')) {
    return false
  }

  const status = order.fulfillment_status.current
  switch (status) {
    // the tag can only be generated when fulfillment_status.current is ready_for_shipping
    case 'ready_for_shipping':
      const shippingService = order.shipping_lines.find(shipping => shipping.app && shipping.app.service_code && shipping.app.service_code.startsWith('ME'))
      if (shippingService) {
        // checks if the order already has a invoices and NF number or flag non_commercial
        // if it not a non_commercial shippin check if order had invoices
        if (appConfig.enabled_non_commercial || (shippingService.invoices &&
          Array.isArray(shippingService.invoices) &&
          shippingService.invoices[0].issuer &&
          shippingService.invoices[0].issuer.doc_number)) {
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
    default: break
  }

  return false
}