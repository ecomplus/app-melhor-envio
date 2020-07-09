module.exports = (order, appConfig, merchantData) => {
  const { firstname, lastname, phone, email, document, address } = merchantData
  const from = {
    name: `${firstname} ${lastname}`,
    phone: phone.phone || '',
    email,
    document,
    address: address.address || '',
    complement: address.complement || '',
    number: address.number || '',
    district: address.district || '',
    city: address.city.city || '',
    state_abbr: address.city.state.state_abbr || '',
    country_id: address.city.state.country.id || '',
    postal_code: address.postal_code || ''
  }

  const shippingLines = order.shipping_lines[0]
  const { name, street, complement, number, borough, city, zip } = shippingLines.to
  const to = {
    name,
    email: order.buyers[0].main_email || '',
    document: order.buyers[0].doc_number || '',
    address: street || '',
    complement,
    number,
    district: borough || '',
    city,
    state_abbr: shippingLines.to.province_code || '',
    country_id: shippingLines.to.country_code || 'BR',
    postal_code: zip || '',
    note: shippingLines.to.near_to || ''
  }

  if (order.buyers && Array.isArray(order.buyers) && order.buyers[0] && order.buyers[0].phones && order.buyers[0].phones[0].number) {
    to.phone = order.buyers[0].phones[0].number
  }

  const package = {
    weight: shippingLines.package && shippingLines.package.weight ? shippingLines.package.weight.value : '',
    width: shippingLines.package && shippingLines.package.dimensions ? shippingLines.package.dimensions.width.value : '',
    height: shippingLines.package && shippingLines.package.dimensions ? shippingLines.package.dimensions.height.value : '',
    length: shippingLines.package && shippingLines.package.dimensions ? shippingLines.package.dimensions.length.value : ''
  }

  const { items } = order
  const products = []
  let insuranceValue = 0
  items.forEach(item => {
    products.push({
      name: item.name,
      quantity: item.quantity,
      unitary_value: item.price
    })
    insuranceValue += item.final_price || item.price
  })

  const options = {
    insurance_value: insuranceValue,
    receipt: (appConfig.receipt),
    own_hand: (appConfig.own_hand),
    collect: false,
    reverse: false,
    platform: 'E-Com Plus',
    tags: [
      {
        tag: `Etiqueta referente ao pedido ${order.number}`,
      }
    ]
  }


  // https://docs.menv.io/?version=latest#9a8f308b-4872-4268-b402-e1b0d64d1f1c
  if (appConfig.enabled_non_commercial) {
    options.non_commercial = true
  }

  const { invoices } = shippingLines
  if (invoices && Array.isArray(invoices) && invoices[0].number) {
    options.invoices = {
      number: invoices[0].number,
      key: invoices[0].access_key
    }
  }

  const label = {
    service: parseInt(shippingLines.app.service_code.replace('ME ', '')),
    from,
    to,
    package,
    products,
    options
  }

  if (appConfig.jadlog_agency) {
    label.agency = appConfig.jadlog_agency
  }

  return label
}