'use strict'
const logger = require('console-files')
const rq = require('request')

const updateMetafields = (body, resource, app) => {
  return new Promise((resolve, reject) => {
    let options = {
      uri: 'https://api.e-com.plus/v1/orders/' + resource + '/hidden_metafields.json',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-ID': app.store_id,
        'X-Access-Token': app.app_token,
        'X-My-ID': app.authentication_id
      },
      body: body,
      json: true
    }
    rq.post(options, (erro, resp, body) => {
      if (resp.statusCode >= 400) {
        logger.log('Erro com a requisição em e-com.plus\n' + resp.body)
        reject(new Error(JSON.stringify(resp.body)))
      }
      resolve(body)
    })
  })
}

const updateOrderStatus = (app, resource, status) => {
  return new Promise((resolve, reject) => {
    let options = {
      uri: 'https://api.e-com.plus/v1/orders/' + resource._id + '/shipping_lines/' + resource.shipping_lines[0]._id + '.json',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-ID': app.store_id,
        'X-Access-Token': app.app_token,
        'X-My-ID': app.authentication_id
      },
      body: {
        status: {
          current: status
        }
      },
      json: true
    }
    rq.patch(options, (erro, resp, body) => {
      if (resp.statusCode >= 400) {
        reject(new Error(JSON.stringify(resp.body)))
      }
      resolve(body)
    })
  })
}

const getOrder = (resourceId, app) => {
  let options = {
    uri: 'https://api.e-com.plus/v1/orders/' + resourceId + '.json',
    headers: {
      'Content-Type': 'application/json',
      'X-Store-ID': app.store_id,
      'X-Access-Token': app.app_token,
      'X-My-ID': app.authentication_id
    }
  }
  return new Promise((resolve, reject) => {
    rq.get(options, async (erro, resp, body) => {
      if (resp.statusCode >= 400) {
        reject(resp.body)
      }
      resolve(body)
    })
  })
}

const getResource = (resource, resourceId, method, headers) => {
  let options = {
    method: method,
    uri: 'https://api.e-com.plus/v1/' + resource + '/' + resourceId + '.json',
    headers: headers
  }
  return new Promise((resolve, reject) => {
    rq(options, async (erro, resp, body) => {
      if (resp.statusCode >= 400) {
        reject(resp.body)
      }
      resolve(JSON.parse(body))
    })
  })
}

const registerProcedure = (app) => {
  let params = {
    title: 'Melhor Envio Shipment Update',
    short_description: 'After received order, update melhor envio cart.',
    triggers: [
      {
        resource: 'orders'
      }
    ],
    webhooks: [
      {
        api: {
          external_api: {
            uri: 'https://melhorenvio.ecomplus.biz/notifications'
          }
        },
        method: 'POST',
        send_body: true
      }
    ],
    tag: 'melhor_envio_orders'
  }
  let options = {
    uri: 'https://api.e-com.plus/v1/procedures.json',
    headers: {
      'Content-Type': 'application/json',
      'X-Store-ID': app.store_id,
      'X-Access-Token': app.app_token,
      'X-My-ID': app.authentication_id
    },
    body: params,
    json: true
  }
  return new Promise((resolve, reject) => {
    rq.post(options, (erro, resp, body) => {
      if (resp.statusCode >= 400) {
        reject(resp.body)
      }
      resolve(body)
    })
  })
}

const orderHasLabel = (order) => {
  if (typeof order.fulfillment_status !== 'undefined') {
    if (typeof order.fulfillment_status.current !== 'undefined') {
      switch (order.fulfillment_status.current) {
        case 'ready_for_shipping':
          if (typeof order.shipping_lines[0].app !== 'undefined' && order.shipping_lines[0].app.service_code === '3') {
            if (typeof order.shipping_lines[0].invoices !== 'undefined') {
              if (typeof order.shipping_lines[0].invoices[0].issuer.doc_number !== 'undefined') {
                if (typeof order.hidden_metafields !== 'undefined') {
                  let label = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')
                  if (!label) {
                    return false
                  } else {
                    return true
                  }
                }
              }
            }
          }
          break
        case 'invoice_issued':
        case 'in_production':
        case 'in_separation':
        case 'partially_shippend':
        case 'shipped':
        case 'partially_delivered':
        case 'returned_for_exchange':
        case 'received_for_exchange':
        case 'returned':
          return true
        default: break
      }
    }
  }
  //
  return true
}

const orderHasSameStatus = async (order, label, app) => {
  // order possui etiqueta?
  order = JSON.parse(order)
  let orderLabel = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id' && label.hasOwnProperty(hidden.value))
  // console.log(orderLabel)
  console.log(label[orderLabel.value].status)
  // 
  if (orderLabel) {
    // case
    switch (label[orderLabel.value].status) {
      case 'posted':
        if (order.shipping_lines[0].status !== 'shipped') {
          return updateOrderStatus(app, order, 'shipped')
        }
        break
      case 'delivered':
        if (order.shipping_lines[0].status !== 'delivered') {
          return updateOrderStatus(app, order, 'delivered')
        }
        break
      case 'undelivered':
        if (order.shipping_lines[0].status !== 'returned') {
          return updateOrderStatus(app, order, 'returned')
        }
        break
      default:
        break
    }
  }
  return false
}

module.exports = {
  updateMetafields,
  registerProcedure,
  orderHasLabel,
  orderHasSameStatus,
  getResource,
  getOrder
}
