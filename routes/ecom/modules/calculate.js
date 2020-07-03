// log on files
const logger = require('console-files')
const { newShipment, matchService, sortServicesBy } = require('../../../lib/melhor-envio/new-shipment')
const meClient = require('../../../lib/melhor-envio/client')
const errorHandling = require('../../../lib/store-api/error-handling')

module.exports = appSdk => {
  return async (req, res) => {
    // body was already pre-validated on @/bin/web.js
    // treat module request body
    const { params, application } = req.body
    const { storeId } = req
    // app configured options
    const config = Object.assign({}, application.data, application.hidden_data)

    if (!config.access_token) {
      // no Melhor Envio access_token
      return res.status(409).send({
        error: 'CALCULATE_SHIPPING_DISABLED',
        message: 'Melhor Envio Token is unset on app hidden data'
      })
    }
    // start mounting response body
    // https://apx-mods.e-com.plus/api/v1/calculate_shipping/response_schema.json?store_id=100
    const response = {
      shipping_services: []
    }

    let shippingRules
    if (Array.isArray(config.shipping_rules) && config.shipping_rules.length) {
      shippingRules = config.shipping_rules
    } else {
      shippingRules = []
    }

    const destinationZip = params.to ? params.to.zip.replace(/\D/g, '') : ''

    const checkZipCode = rule => {
      // validate rule zip range
      if (destinationZip && rule.zip_range) {
        const { min, max } = rule.zip_range
        return Boolean((!min || destinationZip >= min) && (!max || destinationZip <= max))
      }
      return true
    }

    // search for configured free shipping rule
    if (Array.isArray(shippingRules)) {
      for (let i = 0; i < shippingRules.length; i++) {
        const rule = shippingRules[i]
        if (rule.free_shipping) {
          if (!rule.min_amount || !checkZipCode(rule)) {
            response.free_shipping_from_value = 0
            break
          } else if (!(response.free_shipping_from_value <= rule.min_amount)) {
            response.free_shipping_from_value = rule.min_amount
          }
        }
      }
    }

    // params object follows calculate shipping request schema:
    // https://apx-mods.e-com.plus/api/v1/calculate_shipping/schema.json?store_id=100
    if (!params.to) {
      // respond only with free shipping option
      return res.send(response)
    }

    if (params.items) {
      const intZipCode = parseInt(params.to.zip.replace(/\D/g, ''), 10)
      const token = config.access_token
      const sandbox = Boolean(config.sandbox)

      if (!config.merchant_address) {
        // get merchant_address
        const merchantAddress = await meClient({
          url: '/',
          method: 'get',
          token,
          sandbox
        }).then(({ data }) => data.address)

        // update config.merchant_address
        config.merchant_address = merchantAddress

        // save merchant_address in hidden_data
        let resource = `/applications/${application._id}/hidden_data.json`
        let method = 'PATCH'
        let bodyUpdate = {
          merchant_address: merchantAddress
        }

        appSdk
          .apiRequest(storeId, resource, method, bodyUpdate)
          .catch(e => {
            logger.error('!<> Update merchant_address failed', e.message)
          })
      }

      let schema
      try {
        schema = newShipment(config, params)
      } catch (e) {
        logger.error('NEW_SHIPMENT_PARSE_ERR', e)
        res.status(400)
        return res.send({
          error: 'CALCULATE_ERR',
          message: 'Unexpected Error Try Later'
        })
      }

      // calculate the shipment
      return meClient({
        url: '/shipment/calculate',
        method: 'post',
        token,
        data: schema,
        sandbox
      })

        .then(({ data }) => {
          let errorMsg
          data.forEach(service => {
            let isAvailable = true
            // check if service is not disabled
            if (Array.isArray(config.unavailable_for)) {
              for (let i = 0; i < config.unavailable_for.length; i++) {
                const unavailable = config.unavailable_for[i]
                if ((unavailable && unavailable.zip_range) &&
                  (intZipCode >= unavailable.zip_range.min) &&
                  (intZipCode <= unavailable.zip_range.max) &&
                  (unavailable.service_name && matchService(unavailable, service.name))) {
                  isAvailable = false
                }
              }
            }

            if (!service.error && isAvailable) {
              // mounte response body
              const { to } = params
              const from = {
                zip: config.merchant_address.postal_code,
                street: config.merchant_address.address,
                number: parseInt(config.merchant_address.number)
              }

              const package = {
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
              }

              const shippingLines = {
                to,
                from,
                package,
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
                shippingLines.custom_fields.push({
                  field: 'jadlog_agency',
                  value: String(config.jadlog_agency)
                })
              }

              // check for default configured additional/discount price
              if (config.additional_price) {
                if (config.additional_price > 0) {
                  shippingLines.other_additionals = [{
                    tag: 'additional_price',
                    label: 'Adicional padrão',
                    price: config.additional_price
                  }]
                } else {
                  // negative additional price to apply discount
                  shippingLines.discount -= config.additional_price
                }
                // update total price
                shippingLines.total_price += config.additional_price
              }

              // search for discount by shipping rule
              if (Array.isArray(shippingRules)) {
                for (let i = 0; i < shippingRules.length; i++) {
                  const rule = shippingRules[i]
                  if (
                    rule && matchService(rule, service.name) &&
                    (!rule.zip_range ||
                      checkZipCode(rule)) &&
                    !(rule.min_amount > params.subtotal)
                  ) {
                    // valid shipping rule
                    if (rule.free_shipping) {
                      shippingLines.discount += shippingLines.total_price
                      shippingLines.total_price = 0
                      break
                    } else if (rule.discount) {
                      let discountValue = rule.discount.value
                      if (rule.discount.percentage) {
                        discountValue *= (shippingLines.total_price / 100)
                      }
                      shippingLines.discount += discountValue
                      shippingLines.total_price -= discountValue
                      if (shippingLines.total_price < 0) {
                        shippingLines.total_price = 0
                      }
                      break
                    }
                  }
                }
              }

              let label = service.name
              if (config.services && Array.isArray(config.services) && config.services.length) {
                const service = config.services.find(service => {
                  return service && matchService(service, label)
                })
                if (service && service.label) {
                  label = service.label
                }
              }

              response.shipping_services.push({
                label,
                carrier: service.company.name,
                service_name: service.name,
                service_code: `ME ${service.id}`,
                icon: service.company.picture,
                shipping_line: shippingLines
              })
            } else {
              errorMsg += `${service.name}, ${service.error} \n`
            }
          })

          // sort services?
          if (config.sort_services && Array.isArray(response.shipping_services) && response.shipping_services.length) {
            response.shipping_services.sort(sortServicesBy(config.sort_services))
          }

          return (!Array.isArray(response.shipping_services) || !response.shipping_services.length) &&
            errorMsg
            ? res.status(400).send({
              error: 'CALCULATE_ERR_MSG',
              message: errorMsg
            })
            // success response with available shipping services
            : res.send(response)
        })

        .catch(error => {
          errorHandling(error)
          res.status(400)
          return res.send({
            error: 'CALCULATE_ERR',
            message: 'Unexpected Error Try Later'
          })
        })
    } else {
      return res.status(400).send({
        error: 'CALCULATE_EMPTY_CART',
        message: 'Cannot calculate shipping without cart items'
      })
    }
  }
}

