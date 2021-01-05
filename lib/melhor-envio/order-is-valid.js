module.exports = (order, appConfig) => {
  if (!order.fulfillment_status || !order.fulfillment_status.current) {
    return false
  }

  // checks if the order already has a generated tag
  if (order.hidden_metafields && order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')) {
    return false
  }

  // the tag can only be generated when fulfillment_status.current is ready_for_shipping
  if (order.fulfillment_status.current === 'ready_for_shipping' && order.shipping_lines) {
    const shippingService = order.shipping_lines
      .find(shipping => shipping.app && shipping.app.service_code && shipping.app.service_code.startsWith('ME'))
    if (shippingService) {
      // checks if the order already has a invoices and NF number or flag non_commercial
      // if it not a non_commercial shippin check if order had invoices
      if (
        appConfig.enabled_non_commercial ||
        (shippingService.invoices &&
          shippingService.invoices[0] &&
          shippingService.invoices[0].number)
      ) {
        return true
      }
    }
  }

  return false
}
