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
    if (
      config.skip_no_weight_item &&
      params.items && params.items.find(({ weight }) => weight && !weight.value)
    ) {
      return res.status(409).send({
        error: 'CALCULATE_SHIPPING_SKIPPED',
        message: 'Melhor Envio configured to skip no weight items'
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
        if (rule.free_shipping && checkZipCode(rule)) {
          if (!rule.min_amount) {
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
      const sandbox = config.sandbox

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
        let endpoint = `/applications/${application._id}/hidden_data.json`
        let method = 'PATCH'
        let bodyUpdate = {
          merchant_address: merchantAddress
        }

        appSdk
          .apiRequest(storeId, endpoint, method, bodyUpdate)
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
                if (
                  config.unavailable_for[i] && config.unavailable_for[i].zip_range &&
                  config.unavailable_for[i].service_name
                ) {
                  const unavailable = config.unavailable_for[i]
                  if (
                    intZipCode >= unavailable.zip_range.min &&
                    intZipCode <= unavailable.zip_range.max &&
                    matchService(unavailable, service.name)
                  ) {
                    isAvailable = false
                  }
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

              const shippingLine = {
                to,
                from,
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

              const servicePkg = (service.packages && service.packages[0]) || (service.volumes && service.volumes[0])
              if (servicePkg) {
                shippingLine.package = {}
                if (servicePkg.dimensions) {
                  shippingLine.package.dimensions = {
                    width: {
                      value: servicePkg.dimensions.width
                    },
                    height: {
                      value: servicePkg.dimensions.height
                    },
                    length: {
                      value: servicePkg.dimensions.length
                    }
                  }
                }
                if (servicePkg.weight) {
                  shippingLine.package.weight = {
                    value: parseFloat(servicePkg.weight),
                    unit: 'kg'
                  }
                }
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
              if (Array.isArray(shippingRules)) {
                for (let i = 0; i < shippingRules.length; i++) {
                  const rule = shippingRules[i]
                  if (
                    rule &&
                    matchService(rule, service.name) &&
                    checkZipCode(rule) &&
                    !(rule.min_amount > params.subtotal)
                  ) {
                    // valid shipping rule
                    if (rule.free_shipping) {
                      shippingLine.discount += shippingLine.total_price
                      shippingLine.total_price = 0
                      break
                    } else if (rule.discount && rule.service_name) {
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
                shipping_line: shippingLine
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

        .catch(err => {
          let message = 'Unexpected Error Try Later'
          if (err.response && err.isAxiosError) {
            const { data, status, config } = err.response
            let isAppError = true
            if (status >= 500) {
              message = 'Melhor Envio offline no momento'
              isAppError = false
            } else if (data) {
              if (data.errors && typeof data.errors === 'object' && Object.keys(data.errors).length) {
                const errorKeys = Object.keys(data.errors)
                for (let i = 0; i < errorKeys.length; i++) {
                  const meError = data.errors[errorKeys[i]]
                  if (meError && meError.length) {
                    message = Array.isArray(meError) ? meError[0] : meError
                    if (errorKeys[i].startsWith('to.')) {
                      // invalid merchant config on ME
                      // eg.: 'O campo to.postal code deve ter pelo menos 5 caracteres.'
                      isAppError = false
                      break
                    } else {
                      message += errorKeys[i]
                    }
                  }
                }
              } else if (data.error) {
                message = `ME: ${data.error}`
              } else if (data.message) {
                message = `ME: ${data.message}`
              }
            }

            if (isAppError) {
              // debug unexpected error
              logger.error('CalculateShippingErr:', JSON.stringify({
                storeId,
                status,
                data,
                config
              }, null, 4))
            }
          } else {
            errorHandling(err)
          }

          res.status(409)
          return res.send({
            error: 'CALCULATE_ERR',
            message
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
