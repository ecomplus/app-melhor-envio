'use strict'

module.exports.calculateResponse = (services, application, params, from) => {
  let response = services.filter(service => service.error ? false : serviceIsAvailable(service, application, params))
    .map(service => {
      let discounts = applyDiscount(application, params, service)
      return {
        'label': service.name,
        'carrier': service.company.name,
        'service_name': service.name,
        'service_code': 'ME ' + service.id,
        'icon': service.company.picture,
        'shipping_line': {
          'package': {
            'dimensions': {
              'width': {
                'value': service.packages[0].dimensions.width
              },
              'height': {
                'value': service.packages[0].dimensions.height
              },
              'length': {
                'value': service.packages[0].dimensions.length
              }
            },
            'weight': {
              'value': parseFloat(service.packages[0].weight)
            }
          },
          'from': {
            'zip': from.postal_code,
            'street': from.address,
            'number': from.number
          },
          'to': {
            'zip': params.to.zip,
            'name': params.to.name,
            'street': params.to.street,
            'number': params.to.number,
            'borough': params.to.borough,
            'city': params.to.city,
            'province_code': params.to.province_code
          },
          'discount': discounts.discount,
          'posting_deadline': {
            'days': application.data.posting_deadline || 5
          },
          'delivery_time': {
            'days': service.delivery_time
          },
          'price': discounts.price,
          'total_price': discounts.total_price,
          'custom_fields': [
            {
              'field': 'by_melhor_envio',
              'value': 'true'
            },
            {
              'field': 'jadlog_agency',
              'value': String(application.data.jadlog_agency)
            }
          ]
        }
      }
    })
  return response
}

const serviceIsAvailable = (service, application, params) => {
  // Se o aplicativo tiver
  // a propriedade unavailabe_for settada
  if (application.hidden_data.hasOwnProperty('unavailable_for')) {
    // procura pelos serviços
    // cadastrados no objeto
    let unavailable = application.hidden_data.unavailable_for.find(value => {
      // se houver faixa de cep cadastrado
      // significa que o serviço está desativo
      // apenas para uma faixa de cep
      if (value.hasOwnProperty('states')) {
        // então, verifica se o cep bate
        // com o cep informado na requisição do módulo.
        let faixa = value.states.find(state => {
          if (parseInt(params.to.zip.replace('-', '')) <= parseInt(state.from.replace('-', '')) &&
            parseInt(state.to.replace('-', '')) >= parseInt(params.to.zip.replace('-', ''))) {
            // se a faixa de cep bater
            // verifico se o serviço
            // está contido no array
            // unavailable_for.service
            if (value.services.includes(service.name)) {
              return state
            }
          }
        })
        if (faixa) {
          return value
        }
      } else {
        // se não houver faixa de cep cadastrada
        // e se o serviço atual estiver incluso
        // no obj unavailable_for.services
        // o serviço fica indisponível para todo brasil
        if (value.services.includes(service.name)) {
          return service.name
        }
      }
    })
    // se o serviço estiver
    // indisponível retorno false
    if (unavailable) {
      return false
    }
  }
  // retorna true se todos os serviços estiverem ativos
  return true
}

const applyDiscount = (application, params, service) => {
  // se não houver hidden_data
  // ou houver e não houver
  // shipping_discount configurado
  if (!application.hasOwnProperty('hidden_data') || (application.hasOwnProperty('hidden_data') && !application.hidden_data.hasOwnProperty('shipping_discount'))) {
    // retorna valor
    // real do servico
    return {
      price: parseFloat(service.price),
      total_price: parseFloat(service.price),
      discount: 0
    }
  }
  let response = {}
  // se houver regra de descontos
  // verifico se são aplicáveis
  // para o servico atual
  application.hidden_data.shipping_discount.every(shippingDiscount => {
    // se o valor total da compra
    // for maior ou igual ao minimum_subtotal,
    // valor total mínimo para aplicar desconto no frete
    if (params.subtotal >= shippingDiscount.minimum_subtotal) {
      // verifico se o destino do cálculo do frete
      // é válido na faixa de cep configurada no hidden_data do applicativo
      let stateValid = shippingDiscount.states.find(state => (parseInt(params.to.zip.replace('-', '')) >= parseInt(state.from.replace('-', ''))) && (parseInt(params.to.zip.replace('-', '')) <= state.to.replace('-', '')))
      // se a faixa de cep for válida
      // aplico os descontos
      // e retorno o objeto com os valores
      if (stateValid) {
        let total = service.price
        // pode haver percentual
        // configurado
        if (shippingDiscount.discount.hasOwnProperty('percent_value')) {
          total = total - (shippingDiscount.discount.percent_value * total)
        }
        // valor fixo
        // ou os dois
        if (shippingDiscount.discount.hasOwnProperty('fixed_value')) {
          total -= shippingDiscount.discount.fixed_value
        }
        // pode haver adicional
        // configurado para ser aplicado
        // a qualquer valor de frete.
        if (shippingDiscount.hasOwnProperty('addition')) {
          // podendo ser
          // fixo ou percentage
          total += shippingDiscount.addition.type === 'percentage' ? (total * shippingDiscount.addition.value) : shippingDiscount.addition.value
        }
        // se o desconto for 100%
        // o retorno será um número negativo
        // se for negativo o valor total do frete será 0
        let totalPrice = Math.sign(total) === 1 ? parseFloat(total) : 0
        // retorno o objeto com o valor
        // do servico com desconto aplicado
        response = {
          price: parseFloat(service.price),
          total_price: parseFloat(totalPrice),
          discount: parseFloat(service.price) - parseFloat(totalPrice)
        }
      } else {
        // faixa de cep não é válida para aplicar desconto
        response = {
          price: parseFloat(service.price),
          total_price: parseFloat(service.price),
          discount: 0
        }
      }
    } else {
      // valor mínimo da compra
      // não é válido para aplicar
      // desconto no frete
      response = {
        price: parseFloat(service.price),
        total_price: parseFloat(service.price),
        discount: 0
      }
    }
  })
  return response
}

module.exports.isFreeShipping = (application, params) => {
  let is = ''
  if (application.hasOwnProperty('hidden_data') && application.hidden_data.hasOwnProperty('shipping_discount')) {
    application.hidden_data.shipping_discount.every(discount => {
      if (discount.hasOwnProperty('minimum_subtotal') && params.subtotal >= discount.minimum_subtotal) {
        discount.states.some(state => {
          if ((parseInt(params.to.zip.replace('-', '')) >= parseInt(state.from.replace('-', ''))) && (parseInt(params.to.zip.replace('-', '')) <= state.to.replace('-', ''))) {
            is = discount.minimum_subtotal
          }
        })
      }
    })
  }
  return is
}

module.exports.sortBy = sortOrder => {
  switch (sortOrder) {
    case 'price':
      return function (a, b) {
        return a.shipping_line.total_price < b.shipping_line.total_price
      }
    case '-price':
      return function (a, b) {
        return a.shipping_line.total_price > b.shipping_line.total_price
      }
    case 'delivery':
      return function (a, b) {
        return a.shipping_line.delivery_time.days < b.shipping_line.delivery_time.days
      }
    case '-delivery':
      return function (a, b) {
        return a.shipping_line.delivery_time.days > b.shipping_line.delivery_time.days
      }
    default: break
  }
}
