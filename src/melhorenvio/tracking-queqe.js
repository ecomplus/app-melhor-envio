const ENTITY = 'me_tracking'
const SQL = require('./sql')
const logger = require('logger-files')

class TrackingQueqe {
  constructor (xstoreid) {
    this.xstoreid = xstoreid
    this.label = null
  }
  async getAllLabel () {
    this.label = await SQL.select({ store_id: this.xstoreid }, ENTITY).catch(e => logger.log('Erro: ', e))
  }
  async verifyStatus () {
    await this.getAllLabel()
    if (!this.label) {
    }
  }
  getOrder () {
  }
  updateOrder () {
  }
}
let q = new TrackingQueqe(1002)
q.verifyStatus()
module.exports = TrackingQueqe
