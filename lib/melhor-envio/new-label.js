module.exports = (order, appConfig, merchantData) => {
  const { firstname, lastname, phone, email, address } = merchantData
  const from = {
    name: `${firstname} ${lastname}`,
    phone: (phone && phone.phone) || '',
    email
  }
  if (merchantData.company_document) {
    from.company_document = merchantData.company_document
  }
  if (merchantData.document) {
    from[merchantData.document.length > 11 ? 'company_document' : 'document'] = merchantData.document
  }
  if (address) {
    if (typeof address === 'string') {
      from.address = address
    } else {
      ;[
        'address',
        'complement',
        'number',
        'district',
        'postal_code',
        'city',
        'state_abbr',
        'country_id'
      ].forEach(field => {
        from[field] = address[field] || ''
      })
      if (typeof address.city === 'object') {
        from.city = address.city.city || ''
        if (address.city.state) {
          from.state_abbr = address.city.state.state_abbr || ''
          from.country_id = (address.city.state.country && address.city.state.country.id) || ''
        }
      }
    }
  }

  const shippingLine = (order.shipping_lines && order.shipping_lines[0]) || {}
  const buyer = order.buyers && order.buyers[0]
  const to = {
    email: ''
  }

  if (buyer && buyer.main_email) {
    to.email = buyer.main_email
    if (buyer.registry_type === 'j') {
      to.company_document = buyer.doc_number || ''
    } else {
      to.document = buyer.doc_number || ''
    }
    if (buyer.phones && buyer.phones[0]) {
      to.phone = buyer.phones[0].number
    }
  }

  if (shippingLine.to) {
    const { name, street, complement, number, borough, city, zip } = shippingLine.to
    Object.assign(to, {
      name,
      address: street || '',
      complement,
      number,
      district: borough || '',
      city,
      state_abbr: shippingLine.to.province_code || '',
      country_id: shippingLine.to.country_code || 'BR',
      postal_code: zip || '',
      note: shippingLine.to.near_to || ''
    })
  }

  let physicalWeight = 0
  if (shippingLine.package) {
    const { weight } = shippingLine.package
    if (weight && weight.value) {
      switch (weight.unit) {
        case 'kg':
          physicalWeight = weight.value
          break
        case 'g':
          physicalWeight = weight.value / 1000
          break
        case 'mg':
          physicalWeight = weight.value / 1000000
      }
    }
  }

  const getDimensions = side => {
    const dimensions = shippingLine.package && shippingLine.package.dimensions
    if (dimensions && dimensions[side]) {
      const dimension = dimensions[side]
      if (dimension && dimension.unit) {
        let dimensionValue
        switch (dimension.unit) {
          case 'cm':
            dimensionValue = dimension.value
            break
          case 'm':
            dimensionValue = dimension.value * 100
            break
          case 'mm':
            dimensionValue = dimension.value / 10
        }
        return dimensionValue
      }
    }
    return 0
  }

  const products = []
  let insuranceValue = 0
  if (order.items) {
    order.items.forEach(item => {
      products.push({
        name: item.name,
        quantity: item.quantity,
        unitary_value: item.price
      })
      insuranceValue += item.final_price || item.price
    })
  }

  const options = {
    insurance_value: insuranceValue,
    receipt: (appConfig.receipt),
    own_hand: (appConfig.own_hand),
    collect: false,
    reverse: false,
    platform: 'E-Com Plus',
    tags: [
      {
        tag: `Etiqueta referente ao pedido: #${order.number}`
      },
      {
        tag: "order_id",
        url: order._id
      }
    ]
  }

  // https://docs.menv.io/?version=latest#9a8f308b-4872-4268-b402-e1b0d64d1f1c
  if (appConfig.enabled_non_commercial) {
    options.non_commercial = true
  }

  const { invoices } = shippingLine
  if (invoices && Array.isArray(invoices) && invoices[0].number) {
    options.invoices = {
      number: invoices[0].number,
      key: invoices[0].access_key
    }
  }

  const label = {
    from,
    to,
    package: {
      weight: physicalWeight,
      width: getDimensions('width'),
      height: getDimensions('height'),
      length: getDimensions('length')
    },
    products,
    options
  }

  if (shippingLine.app && shippingLine.app.service_code) {
    label.service = parseInt(shippingLine.app.service_code.replace('ME ', ''))
  }
  if (appConfig.jadlog_agency) {
    label.agency = appConfig.jadlog_agency
  }

  return label
}
