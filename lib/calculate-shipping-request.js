'use strict'

module.exports = (application, params, from) => {
  const address = params.to || {}
  const appData = application.data || {}
  try {
    const calculateShipping = {
      from: JSON.parse(from),
      to: {
        postal_code: address.zip || '',
        address: address.street || '',
        number: address.number || ''
      },
      options: {
        receipt: appData.receipt || false,
        own_hand: appData.own_hand || false,
        collect: false
      },
      products: []
    }

    // parse products
    params.items.forEach(item => {
      if (item.hasOwnProperty('dimensions')) {
        calculateShipping.products.push({
          id: item.product_id,
          weight: item.weight.unit === 'g' ? parseFloat(item.weight.value / 1000) : item.weight.value,
          width: item.dimensions.width.unit === 'm' ? item.dimensions.width.value * 100 : item.dimensions.width.value,
          height: item.dimensions.height.unit === 'm' ? item.dimensions.height.value * 100 : item.dimensions.height.value,
          length: item.dimensions.length.unit === 'm' ? item.dimensions.length.value * 100 : item.dimensions.length.value,
          quantity: item.quantity,
          insurance_value: item.final_price
        })
      }
    })

    return calculateShipping
  } catch (error) {
    console.log(error)
    return false
  }
}
