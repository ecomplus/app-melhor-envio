'use strict'
const sql = require('../sql')

module.exports.generateLabel = (order, seller, data) => {
  return new Promise((resolve, reject) => {
    try {
      resolve({
        'service': parseInt(order.shipping_lines[0].app.service_code.replace('ME ', '')),
        'agency': data.jadlog_agency,
        'from': labelGenerate.from(seller),
        'to': labelGenerate.to(order),
        'products': [labelGenerate.products(order.items)],
        'package': labelGenerate.package(order.shipping_lines[0].package),
        'options': labelGenerate.options(order, data)
      })
    } catch (error) {
      reject(error)
    }
  })
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
  options: (order, data) => {
    return { // opções
      'insurance_value': order.shipping_lines[0].declared_value, // valor declarado/segurado
      'receipt': data.receipt, // aviso de recebimento
      'own_hand': data.own_hand, // mão pŕopria
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

module.exports.saveLabel = (label, storeId, resourceId) => {
  return new Promise((resolve, reject) => {
    let params = {
      label_id: label.id,
      status: label.status,
      resource_id: resourceId,
      store_id: storeId
    }
    sql.insert(params, 'melhorenvio_app_tracking')
      .then(resolve)
      .catch(reject)
  })
}
