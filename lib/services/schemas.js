const logger = require('console-files')

module.exports = {
  calculateRequest: (payload) => {
    if (typeof payload.application === 'undefined') {
      return false
    }
    try {
      let calculateObj = {}
      calculateObj.from = {}
      calculateObj.from.postal_code = payload.application.hidden_data.from.zip
      calculateObj.from.address = payload.application.hidden_data.from.street
      calculateObj.from.number = payload.application.hidden_data.from.number

      calculateObj.to = {}
      calculateObj.to.postal_code = payload.params.to.zip
      calculateObj.to.address = payload.params.to.street
      calculateObj.to.number = payload.params.to.number

      calculateObj.products = calculateItems(payload.params.items) || null

      calculateObj.options = {}
      calculateObj.options.receipt = payload.application.data.receipt
      calculateObj.options.own_hand = payload.application.data.own_hand
      calculateObj.options.collect = false
      return calculateObj
    } catch (error) {
      logger.log('Schema inválido para cálculo.')
      return false
    }
  },
  calculateResponse: (payload, from, to, packageRequest) => {
    let retorno = []
    retorno = payload.filter(servico => {
      if (servico.error) {
        return false
      }
      return isAvailable(servico, packageRequest)
    }).map(service => {
      let discounts = discount(packageRequest, service)
      return {
        label: service.name,
        carrier: service.company.name,
        service_name: service.name,
        service_code: 'ME ' + service.id,
        icon: service.company.picture,
        shipping_line: {
          package: {
            dimensions: {
              width: {
                value: service.packages[0].dimensions.width
              },
              height: {
                value: service.packages[0].dimensions.height
              },
              length: {
                value: service.packages[0].dimensions.length
              }
            },
            weight: {
              value: parseInt(service.packages[0].weight)
            }
          },
          from: {
            zip: from.postal_code,
            street: from.address,
            number: from.number
          },
          to: {
            zip: to.postal_code,
            street: to.address,
            number: to.number
          },
          discount: discounts.discount,
          posting_deadline: {
            days: packageRequest.application.data.posting_deadline || 5
          },
          delivery_time: {
            days: service.delivery_time
          },
          price: discounts.price,
          total_price: discounts.total_price,
          custom_fields: [
            {
              field: 'by_melhor_envio',
              value: 'true'
            },
            {
              field: 'jadlog_agency',
              value: packageRequest.application.data.jadlog_agency.toString()
            }
          ]
        }
      }
    })
    return retorno
  },
  calculateDefault: (payload) => {
    if (typeof payload.application !== 'undefined') {
      if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.minimum_subtotal !== 'undefined') {
        return { shipping_services: [], free_shipping_from_value: payload.application.hidden_data.minimum_subtotal }
      } else {
        return { shipping_services: [] }
      }
    } else {
      return { shipping_services: [] }
    }
  },
  buyLabel: (order, seller, appData) => {
    return {
      'service': order.shipping_lines[0].app.service_code,
      'agency': appData.data.jadlog_agency,
      'from': labelGenerate.from(seller),
      'to': labelGenerate.to(order),
      'products': [labelGenerate.products(order.items)],
      'package': labelGenerate.package(order.shipping_lines[0].package),
      'options': labelGenerate.options(order, appData)
    }
  }
}

const discount = (payload, calculate) => {
  // se o hidden_data do app estiver configurado
  // e se as opcoes de desconto estiver configuradas
  // tenta aplicar o desconto
  let resp
  if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.shipping_discount !== 'undefined') {
    // se o total da compra for maior ou igual
    // ao valor mínimo configurado no app
    if (payload.params.subtotal >= payload.application.hidden_data.minimum_subtotal) {
      //
      payload.application.hidden_data.shipping_discount.every(discount => {
        // busco as faixas de cep
        // configuradas no hidden_data
        let stateValid = false
        discount.states.some(state => {
          // se de destino estiver na faixa ceps configurados no app aplica o desconto
          if (parseInt(payload.params.to.zip.replace('-', '')) <= parseInt(state.from.replace('-', '')) &&
            parseInt(state.to.replace('-', '')) >= parseInt(payload.params.to.zip.replace('-', ''))) {
            stateValid = true
          }
        })
        //
        let finalPrice = 0

        if (stateValid) {
          //
          let total = calculate.price
          //
          if (typeof discount.discount.fixed_value !== 'undefined') {
            total = total - discount.discount.fixed_value
          }
          //
          if (typeof discount.discount.percent_value !== 'undefined') {
            total = total - (discount.discount.percent_value * total)
          }
          //
          if (typeof discount.addition !== 'undefined') {
            if (discount.addition.type === 'percentage') {
              total += (total * discount.addition.value)
            } else if (discount.addition.type === 'fixed') {
              total += discount.addition.value
            }
          }
          //
          finalPrice = Math.sign(total) === 1 ? parseFloat(total) : 0
          resp = {
            price: parseFloat(calculate.price),
            total_price: parseFloat(finalPrice),
            discount: parseFloat(calculate.price) - parseFloat(finalPrice)
          }
        } else {
          resp = {
            price: parseFloat(calculate.price),
            total_price: parseFloat(calculate.price),
            discount: 0
          }
        }
      })
      //
    } else {
      resp = {
        price: parseFloat(calculate.price),
        total_price: parseFloat(calculate.price),
        discount: 0
      }
    }
  } else {
    return {
      price: parseFloat(calculate.price),
      total_price: parseFloat(calculate.price),
      discount: 0
    }
  }
  return resp
}

const calculateItems = (items) => {
  if (items) {
    let products = []
    products = items.map(item => {
      let p = {
        id: item.product_id,
        weight: item.dimensions.weight,
        width: item.dimensions.width.value,
        height: item.dimensions.height.value,
        length: item.dimensions.length.value,
        insurance_value: item.final_price
      }
      return p
    })
    return products
  }
  return false
}

const isAvailable = (service, payload) => {
  //
  if (payload.application.hidden_data.hasOwnProperty('unavailable_for')) {
    //
    let unavailable = payload.application.hidden_data.unavailable_for.find(value => {
      //
      if (value.hasOwnProperty('states')) {
        //
        let faixa = value.states.find(state => {
          //
          if (parseInt(payload.params.to.zip.replace('-', '')) <= parseInt(state.from.replace('-', '')) &&
            parseInt(state.to.replace('-', '')) >= parseInt(payload.params.to.zip.replace('-', ''))) {
            //
            if (value.services.includes(service.name)) {
              return state
            }
          }
        })
        if (faixa) {
          return value
        }
      } else {
        if (value.services.includes(service.name)) {
          return service.name
        }
      }
    })
    //
    if (unavailable) {
      return false
    }
  }
  return true
}

const labelGenerate = {
  from: (seller) => {
    seller = JSON.parse(seller)
    return {
      'name': seller.firstname + seller.lastname,
      'phone': seller.phone.phone,
      'email': seller.email, // email (opcional)
      'document': seller.document, // cpf (opcional)
      // 'company_document': '89794131000100', // cnpj (obrigatório se não for Correios)
      // 'state_register': '123456', // inscrição estadual (obrigatório se não for Correios) pode ser informado 'isento'
      'address': seller.address.address,
      'complement': seller.address.complement,
      'number': seller.address.number,
      'district': seller.address.district,
      'city': seller.address.city.city,
      'state_abbr': seller.address.city.state.state_abbr,
      'country_id': seller.address.city.state.country.id,
      'postal_code': seller.address.postal_code
    }
  },
  to: (order) => {
    return {
      'name': order.shipping_lines[0].to.name,
      'phone': order.shipping_lines[0].to.phone.number, // telefone com ddd (obrigatório se não for Correios)
      'email': order.buyers[0].main_email,
      'document': order.buyers[0].doc_number, // obrigatório se for transportadora e não for logística reversa
      // 'company_document': '89794131000100', // (opcional) (a menos que seja transportadora e logística reversa)
      // 'state_register': '123456', // (opcional) (a menos que seja transportadora e logística reversa)
      'address': order.shipping_lines[0].to.street,
      'complement': order.shipping_lines[0].to.complement,
      'number': order.shipping_lines[0].to.number,
      'district': order.shipping_lines[0].to.borough,
      'city': order.shipping_lines[0].to.city,
      'state_abbr': order.shipping_lines[0].to.province_code,
      'country_id': order.shipping_lines[0].to.country_code,
      'postal_code': order.shipping_lines[0].to.zip,
      'note': order.shipping_lines[0].to.near_to // (opcional) impresso na etiqueta
    }
  },
  products: (items) => {
    let products = {}
    items.forEach(element => {
      products = {
        'name': element.name,
        'quantity': element.quantity,
        'unitary_value': element.price
      }
    }, products)
    return products
  },
  package: (packages) => {
    return {
      'weight': packages.weight,
      'width': packages.dimensions.width.value,
      'height': packages.dimensions.height.value,
      'length': packages.dimensions.length.value
    }
  },
  options: (order, appData) => {
    return { // opções
      'insurance_value': order.shipping_lines[0].declared_value, // valor declarado/segurado
      'receipt': appData.data.receipt, // aviso de recebimento
      'own_hand': appData.data.own_hand, // mão pŕopria
      'collect': false, // coleta
      'reverse': false, // logística reversa (se for reversa = true, ainda sim from será o remetente e to o destinatário)
      'non_commercial': false, // envio de objeto não comercializável (flexibiliza a necessidade de pessoas júridicas para envios com transportadoras como Latam Cargo, porém se for um envio comercializável a mercadoria pode ser confisca pelo fisco)
      'invoice': { // nota fiscal (opcional se for Correios)
        'number': order.shipping_lines[0].invoices[0].number, // número da nota
        'key': order.shipping_lines[0].invoices[0].access_key // chave da nf-e
      }
    }
  }
}
