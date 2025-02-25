module.exports = (order, appConfig) => {
  if (!order.fulfillment_status || !order.shipping_lines) {
    return false
  }

  // verifica se o calculo do frete foi feito com o app-melhor-envio
  const isByMelhorEnvio = Boolean(order.shipping_lines.find(shippingLine => {
    return shippingLine.custom_fields && shippingLine.custom_fields.find(({ field }) => {
      return field === 'by_melhor_envio'
    })
  }))

  // checa se a opção de envio não comercial está habilitada
  const isNonCommercial = () => (appConfig.enabled_non_commercial)

  // verifica se o pedido está pronto para envio pela ultima entrada no fulfillments ao inves de checar o fulfillment_status
  const isReadyForShipping = () => {
    let statusToCheck = 'ready_for_shipping'
    switch (appConfig.new_label_status) {
      case 'Em produção':
        statusToCheck = 'in_production'
        break
      case 'Em separação':
        statusToCheck = 'in_separation'
        break
      case 'Pronto para envio':
        statusToCheck = 'ready_for_shipping'
        break
      case 'NF emitida':
        statusToCheck = 'invoice_issued'
        break
    }
    const { current } = order.fulfillment_status
    return (current && current === statusToCheck)
  }

  // checa se foi emitida nf para o pedido
  const hasInvoice = () => {
    return Boolean(order.shipping_lines.find(({ invoices }) => {
      return invoices && invoices[0] && invoices[0].number
    }))
  }

  const hasLabelBuyIt = () => {
    if (order.hidden_metafields) {
      return order.hidden_metafields
        .find(({ field }) => field === 'melhor_envio_label_id')
    }

    return false
  }

  if (!isByMelhorEnvio || !isReadyForShipping() || hasLabelBuyIt()) {
    return false
  }

  if (isNonCommercial() || hasInvoice()) {
    return true
  }

  return false
}
