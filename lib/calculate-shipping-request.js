'use strict'

module.exports = (application, params, seller) => {
  const address = params.to || {}
  const appData = application.data || {}
  try {
    const from = JSON.parse(seller)
    const calculateShipping = {
      from: (typeof from.address === 'string' ? from : from.address),
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
      const { dimensions, weight, quantity } = item
      // sum physical weight
      let physicalWeight = 0
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

      calculateShipping.products.push({
        id: item.product_id,
        weight: physicalWeight,
        width: convertDimensions(dimensions && dimensions.width),
        height: convertDimensions(dimensions && dimensions.height),
        length: convertDimensions(dimensions && dimensions.length),
        quantity,
        insurance_value: item.final_price || item.price
      })
    })

    return calculateShipping
  } catch (error) {
    throw new Error(error)
  }
}

const convertDimensions = dimension => {
  let dimensionValue = 0
  if (dimension && dimension.unit) {
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
  }
  return dimensionValue
}
