'use strict'
const logger = require('console-files')
module.exports = (order, defaultSeller, appData) => {
  try {
    let seller = JSON.parse(defaultSeller)
    const shippingLines = order.shipping_lines[0] || {}
    const labelModel = {
      service: parseInt(shippingLines.app.service_code.replace('ME ', '')),
      agency: appData.jadlog_agency,
      from: {
        name: seller.firstname + ' ' + seller.lastname,
        phone: seller.phone.phone || '',
        email: seller.email || '',
        document: seller.document || '',
        address: seller.address.address || '',
        complement: seller.address.complement || '',
        number: seller.address.number || '',
        district: seller.address.district || '',
        city: seller.address.city.city || '',
        state_abbr: seller.address.city.state.state_abbr || '',
        country_id: seller.address.city.state.country.id || '',
        postal_code: seller.address.postal_code || ''
      },
      to: {
        name: shippingLines.to.name || '',
        phone: (shippingLines.to.hasOwnProperty('phone') ? shippingLines.to.phone.number : order.buyers[0].phones.number) || '',
        email: order.buyers[0].main_email || '',
        document: order.buyers[0].doc_number || '',
        address: shippingLines.to.street || '',
        complement: shippingLines.to.complement || '',
        number: shippingLines.to.number || '',
        district: shippingLines.to.borough || '',
        city: shippingLines.to.city || '',
        state_abbr: shippingLines.to.province_code || '',
        country_id: shippingLines.to.country_code || 'BR',
        postal_code: shippingLines.to.zip || '',
        note: shippingLines.to.near_to || ''
      },
      package: {
        weight: shippingLines.package.weight || '',
        width: shippingLines.package.dimensions.width.value || '',
        height: shippingLines.package.dimensions.height.value || '',
        length: shippingLines.package.dimensions.length.value || ''
      },
      products: [],
      options: { // opções
        insurance_value: shippingLines.declared_value, // valor declarado/segurado
        receipt: appData.receipt, // aviso de recebimento
        own_hand: appData.own_hand, // mão pŕopria
        collect: false, // coleta
        reverse: false, // logística reversa (se for reversa = true, ainda sim from será o remetente e to o destinatário)
        non_commercial: false, // envio de objeto não comercializável (flexibiliza a necessidade de pessoas júridicas para envios com transportadoras como Latam Cargo, porém se for um envio comercializável a mercadoria pode ser confisca pelo fisco)
        invoice: { // nota fiscal (opcional se for Correios)
          number: shippingLines.invoices[0].number, // número da nota
          key: shippingLines.invoices[0].access_key // chave da nf-e
        }
      }
    }

    // products
    order.items.forEach(item => {
      labelModel.products.push({
        name: item.name,
        quantity: item.quantity,
        unitary_value: item.price
      })
    })

    return labelModel
  } catch (error) {
    console.log(error)
    logger.error(error)
    return []
  }
}
