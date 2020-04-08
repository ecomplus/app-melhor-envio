'use strict'
// log on files
const logger = require('console-files')

// read configured internal app data
// like melhor-envio access_token, user from, etc.
const { getAppConfig } = require('./../../../lib/Api/Api')

// parse calculate body from modules API to melhor-envio model
const meSchema = require('./../../../lib/calculate-shipping-request')

module.exports = (appSdk, me) => {
  return async (req, res) => {
    let schema = {}
    const { application, params } = req.body
    const { storeId } = req
    const config = Object.assign({}, application.data, application.hidden_data)
    const response = {
      shipping_services: []
    }
    logger.log(JSON.stringify(req.body))
    // search for configured free shipping rule
    if (Array.isArray(config.shipping_rules)) {
      for (let i = 0; i < config.shipping_rules.length; i++) {
        const rule = config.shipping_rules[i]
        if (rule.free_shipping) {
          if (!rule.min_amount) {
            response.free_shipping_from_value = 0
            break
          } else if (!(response.free_shipping_from_value <= rule.min_amount)) {
            response.free_shipping_from_value = rule.min_amount
          }
        }
      }
    }

    const { to, subtotal, items } = params

    if (!to || !subtotal || !items) {
      return res.send(response)
    }

    // calculate promise
    let promise = null

    // checks if access_token has been set in the hidden_data of the app
    if (config.access_token) {
      me.setToken = config.access_token
      // get user data
      promise = me.user.me()
        .then(seller => {
          schema = meSchema(application, params, seller)
          // erro?
          if (!schema) {
            return res.send(response)
          }

          // try calculate
          return me.shipment.calculate(schema)
        })
    } else {
      // try to find oauth in db
      promise = await getAppConfig(storeId)

        .then(auth => {
          schema = meSchema(application, params, auth.default_data)

          if (!schema) {
            return res.send(response)
          }

          me.setToken = auth.access_token
          return me.shipment.calculate(schema)
        }).catch(e => {
          // not found
          console.log(e.message)
        })
    }

    // oauth not found and access_token not configured, calculation cannot be performed without authentication
    if (!promise) {
      res.status(400)
      return res.send({
        error: 'The access_token is unset at application settings',
        message: 'Unexpected Error Try Later'
      })
    }

    // done?
    promise.then(services => {
      logger.log(JSON.stringify(services))
      if (Array.isArray(services) && services.length) {
        let errorMsg = ''
        services.forEach(service => {
          const { error } = service

          let isAvailable = true
          // check if service is not disabled
          if (Array.isArray(config.unavailable_for)) {
            for (let i = 0; i < config.unavailable_for.length; i++) {
              const unavailable = config.unavailable_for[i]
              const shippingTo = parseInt(to.zip.replace('-', ''))
              if ((unavailable && unavailable.zip_range) &&
                (shippingTo >= parseInt(unavailable.zip_range.min)) &&
                (shippingTo <= parseInt(unavailable.zip_range.max)) &&
                (unavailable.service_name === service.name)) {
                isAvailable = false
              }
            }
          }

          if (!error && isAvailable) {
            const shippingLine = {
              from: {
                zip: schema.from.postal_code,
                street: schema.from.address,
                number: parseInt(schema.from.number)
              },
              to,
              package: {
                dimensions: {
                  width: {
                    value: service.packages ? service.packages[0].dimensions.width : service.volumes[0].dimensions.width
                  },
                  height: {
                    value: service.packages ? service.packages[0].dimensions.height : service.volumes[0].dimensions.height
                  },
                  length: {
                    value: service.packages ? service.packages[0].dimensions.length : service.volumes[0].dimensions.length
                  }
                },
                weight: {
                  value: service.packages ? parseFloat(service.packages[0].weight) : parseFloat(service.volumes[0].weight)
                }
              },
              own_hand: service.additional_services.own_hand,
              receipt: service.additional_services.receipt,
              discount: 0,
              total_price: parseFloat(service.price),
              delivery_time: {
                days: parseInt(service.delivery_time, 10),
                working_days: true
              },
              posting_deadline: {
                days: 3,
                ...config.posting_deadline
              },
              custom_fields: [
                {
                  field: 'by_melhor_envio',
                  value: 'true'
                }
              ]
            }

            if (config.jadlog_agency) {
              shippingLine.custom_fields.push({
                field: 'jadlog_agency',
                value: String(config.jadlog_agency)
              })
            }

            // check for default configured additional/discount price
            if (config.additional_price) {
              if (config.additional_price > 0) {
                shippingLine.other_additionals = [{
                  tag: 'additional_price',
                  label: 'Adicional padrão',
                  price: config.additional_price
                }]
              } else {
                // negative additional price to apply discount
                shippingLine.discount -= config.additional_price
              }
              // update total price
              shippingLine.total_price += config.additional_price
            }

            // search for discount by shipping rule
            if (Array.isArray(config.shipping_rules)) {
              for (let i = 0; i < config.shipping_rules.length; i++) {
                const rule = config.shipping_rules[i]
                if (
                  rule &&
                  (!rule.service_code || rule.service_code === service.name) &&
                  (!rule.zip_range ||
                    (parseInt(to.zip) >= parseInt(rule.zip_range.min)) && (parseInt(to.zip) <= parseInt(rule.zip_range.max))) &&
                  !(rule.min_amount > subtotal)
                ) {
                  // valid shipping rule
                  if (rule.free_shipping) {
                    shippingLine.discount += shippingLine.total_price
                    shippingLine.total_price = 0
                    break
                  } else if (rule.discount) {
                    let discountValue = rule.discount.value
                    if (rule.discount.percentage) {
                      discountValue *= (shippingLine.total_price / 100)
                    }
                    shippingLine.discount += discountValue
                    shippingLine.total_price -= discountValue
                    if (shippingLine.total_price < 0) {
                      shippingLine.total_price = 0
                    }
                    break
                  }
                }
              }
            }

            response.shipping_services.push({
              label: service.name,
              carrier: service.company.name,
              service_name: service.name,
              service_code: `ME ${service.id}`,
              icon: service.company.picture,
              shipping_line: shippingLine
            })

            // sort services?
            if (config.sort_services) {
              response.shipping_services.sort(sortServicesBy(config.sort_services))
            }
          } else {
            errorMsg += `Service ${service.name} erro, ${service.error} \n`
          }
        })
        logger.log('response', JSON.stringify(response))
        return (!Array.isArray(response.shipping_services) || !response.shipping_services.length) &&
          errorMsg
          ? res.status(400).send({
            error: 'CALCULATE_ERR_MSG',
            message: errorMsg
          })
          // success response with available shipping services
          : res.send(response)
      }
    })

      .catch(error => {
        logger.error('CALCULATE_ERR', error)
        res.status(400)
        return res.send({
          error: 'CALCULATE_ERR',
          message: 'Unexpected Error Try Later'
        })
      })
  }
}

const sortServicesBy = by => {
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
