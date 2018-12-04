'use strict'
const sql = require('./sql')
const melhorenvio = require('./melhor-envio')
const ecomplus = require('./ecomplus')
/**
 * Jobs
 */
const updateLabelStatus = async () => {
  let query = 'SELECT * FROM `me_tracking` WHERE status = ? OR status = ? OR status = ? OR status = ? ORDER BY store_id'
  sql.db.all(query, ['pending', 'released', 'delivered', 'undelivered'], function (erro, row) {
    if (erro) {
      return
    }
    let storeId
    let app
    row.forEach(async (label, index) => {
      setTimeout(async () => {
        // guardo o x_store_id
        if (storeId !== label.store_id) {
          app = await melhorenvio.getAppData(label.store_id)
        }
        //
        let meLabel = await melhorenvio.getLabel(label.label_id, app).catch(e => console.log(e))
        //
        let order = await ecomplus.getOrder(label.resource_id, app).catch(e => console.log(e))
        //
        ecomplus.orderHasSameStatus(order, meLabel, app)
        //
        storeId = label.store_id
      }, 1000 * index)
    })
  })
}

/**
 * Tasks
 */
// Verifica status das etiquetas
// a cada 30m
updateLabelStatus()
setInterval(updateLabelStatus, 30 * 60 * 1000)
