'use strict'
/**
 * @description Realiza parse da body enviado para o módulo para realizar o calculo do frete no Melhor Envio.
 * @param {Object} application Objeto application enviado pelo módulo da api.
 * @param {Object} params Objeto com as informações do cáculo, itens, endereços..
 * @param {String} defaultFrom String Json com as informações default de retirada da mercadoria, o mesmo cadastrado na conta do usuário no melhor envio.
 * @returns {Object} Schema para o payload do cálculo do frete na api do melhor envio.
 */
module.exports.calculateRequest = (application, params, defaultFrom) => {
  if (params.to.hasOwnProperty('zip') && params.to.zip === '') {
    return false
  }

  try {
    let calculateObj = {}

    if (application.hasOwnProperty('hidden_data') && application.hidden_data.hasOwnProperty('from')) {
      calculateObj.from = {
        'postal_code': application.hidden_data.from.zip,
        'address': application.hidden_data.from.street,
        'number': application.hidden_data.from.number
      }
    } else {
      calculateObj.from = JSON.parse(defaultFrom)
    }
    //
    calculateObj.to = {
      'postal_code': params.to.zip,
      'address': params.to.street,
      'number': params.to.number
    }

    calculateObj.products = calculateItems(params.items) || null

    calculateObj.options = {
      'receipt': application.data.receipt,
      'own_hand': application.data.own_hand,
      'collect': false
    }

    return calculateObj
  } catch (error) {
    return false
  }
}

const calculateItems = (items) => {
  if (items) {
    let products = items.filter(product => product.hasOwnProperty('dimensions'))
      .map(item => {
        return {
          'id': item.product_id,
          'weight': item.weight.unit === 'g' ? parseFloat(item.weight.value / 1000) : item.weight.value,
          'width': item.dimensions.width.unit === 'm' ? item.dimensions.width.value * 100 : item.dimensions.width.value,
          'height': item.dimensions.height.unit === 'm' ? item.dimensions.height.value * 100 : item.dimensions.height.value,
          'length': item.dimensions.length.unit === 'm' ? item.dimensions.length.value * 100 : item.dimensions.length.value,
          'quantity': item.quantity,
          'insurance_value': item.final_price
        }
      })
    return products
  }
  return false
}
