module.exports = (order, appConfig) => {
  if (!order.fulfillment_status || !order.shipping_lines) {
    return false
  }

  // verifica se o calculo do frete foi feito com o app-melhor-envio
  const isByMelhorEnvio = order.shipping_lines
    .map(shippingLine => (shippingLine.custom_fields || [{}]))[0]
    .some(({ field }) => (field === 'by_melhor_envio'))

  // checa se a opção de envio não comercial está habilitada
  const isNonCommercial = () => (appConfig.enabled_non_commercial)

  // verifica se o pedido está pronto para envio pela ultima entrada no fulfillments ao inves de checar o fulfillment_status
  const isReadyForShipping = () => {
    const { current } = order.fulfillment_status
    return (current && current === 'ready_for_shipping')
  }

  // checa se foi emitida nf para o pedido
  const hasInvoice = () => {
    return order.shipping_lines.find(({ invoices }) => {
      return invoices && invoices[0] && invoices[0].number
    })
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
