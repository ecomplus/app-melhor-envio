const ENTITY = 'me_tracking'
const SQL = require('./sql')

class TrackingQueqe {
  constructor (xstoreid) {
    this.xstoreid = xstoreid
    this.label = null
  }
  async getAllLabel () {
    this.label = await SQL.select({ store_id: this.xstoreid }, ENTITY).catch(e => console.log('Erro: ', e))
  }
  async verifyStatus () {
    await this.getAllLabel()
    console.log(this.label)
  }
  getOrder () {
  }
  updateOrder () {
  }
}
let q = new TrackingQueqe(1002)
q.verifyStatus()
module.exports = TrackingQueqe
