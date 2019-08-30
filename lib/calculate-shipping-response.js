'use strict'

const sortBy = by => {
  switch (by) {
    case 'Maior preço':
      return function (a, b) {
        return a.shipping_line.total_price < b.shipping_line.total_price
      }
    case 'Menor preço':
      return function (a, b) {
        return a.shipping_line.total_price > b.shipping_line.total_price
      }
    case 'Maior prazo de entrega':
      return function (a, b) {
        return a.shipping_line.delivery_time.days < b.shipping_line.delivery_time.days
      }
    case 'Menor prazo de entrega':
      return function (a, b) {
        return a.shipping_line.delivery_time.days > b.shipping_line.delivery_time.days
      }
    default: break
  }
}

// checks if service was not disabled
const serviceIsEnabled = (service, hidden_data, params) => {
  // if unavailable_for is not configured
  // search for services disabled
  if (hidden_data.unavailable_for && hidden_data.unavailable_for !== null) {
    let unavailabledServices = hidden_data.unavailable_for.find(unavailable => {
      // checks if postal_service is configured
      // if not and service is present at unavailable_for
      // means that service is unavailable for all brazil
      let postalCodes = unavailable.states.find(postalCode => {
        if ((parseInt(params.to.zip.replace('-', '')) <= parseInt(postalCode.from.replace('-', '')))
          && (parseInt(postalCode.to.replace('-', '')) >= parseInt(params.to.zip.replace('-', '')))) {
          if (unavailable.services.includes(service.name)) {
            return postalCode
          }
        }
      })
      return (postalCodes)
    })
    return (unavailabledServices)
  }
  // if unavailable_for is not configured
  // all services is available
  return true
}

// checks if the discount configured in the application is applicable at service
const discountIsValid = (hidden_data, params, service) => {
  if ((!hidden_data) || (hidden_data && !hidden_data.hasOwnProperty('shipping_discount'))) {
    return {
      price: parseFloat(service.price),
      total_price: parseFloat(service.price),
      discount: 0
    }
  }

  let discounts = {}
  hidden_data.shipping_discount.every(settings => {
    if (params.subtotal >= settings.minimum_subtotal) {
      let postalCodeIsValidToApplyDiscount = settings.states.find(state => (parseInt(params.to.zip.replace('-', '')) >= parseInt(state.from.replace('-', ''))) && (parseInt(params.to.zip.replace('-', '')) <= state.to.replace('-', '')))
      if (postalCodeIsValidToApplyDiscount) {
        let total = service.price
        // percent discount?
        if (settings.discount.percent_value) {
          total = total - (settings.discount.percent_value * total)
        }
        // fixes discout?
        if (settings.discount.fixed_value) {
          total -= settings.discount.fixed_value
        }
        // additional value
        if (settings.addition) {
          total += settings.addition.type === 'percentage' ? (total * settings.addition.value) : settings.addition.value
        }
        // if discount it is 100% will return a negative number
        let totalPrice = Math.sign(total) === 1 ? parseFloat(total) : 0
        discounts = {
          price: parseFloat(service.price),
          total_price: parseFloat(totalPrice),
          discount: parseFloat(service.price) - parseFloat(totalPrice)
        }
      } else {
        discounts = {
          price: parseFloat(service.price),
          total_price: parseFloat(service.price),
          discount: 0
        }
      }
    } else {
      discounts = {
        price: parseFloat(service.price),
        total_price: parseFloat(service.price),
        discount: 0
      }
    }
  })
  return discounts
}

module.exports = (services, application, params, from) => {
  const { hidden_data } = application
  // parse reponse to API modules
  let response = services
    .filter(service => service.error ? false : serviceIsEnabled(service, hidden_data, params))
    .map(service => {
      let discounts = discountIsValid(hidden_data, params, service)
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
                'value': service.hasOwnProperty('packages') ? service.packages[0].dimensions.width : service.volumes[0].dimensions.width
              },
              'height': {
                'value': service.hasOwnProperty('packages') ? service.packages[0].dimensions.height : service.volumes[0].dimensions.height
              },
              'length': {
                'value': service.hasOwnProperty('packages') ? service.packages[0].dimensions.length : service.volumes[0].dimensions.length
              }
            },
            'weight': {
              'value': service.hasOwnProperty('packages') ?  parseFloat(service.packages[0].weight) :  parseFloat(service.volumes[0].weight)
            }
          },
          'from': {
            'zip': from.postal_code,
            'street': from.address,
            'number': parseInt(from.number)
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
  // sort services?
  if (application.data && application.data.sort) {
    response.sort(sortBy(application.data.sort))
  }
  return response
}
