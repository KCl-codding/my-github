// config/api.config.js
//const IPV4 = '192.168.43.253'
 const IPV4 = '152.136.116.146'
const PORT = 8080
const PORT_MESSAGE = 8081

const API_CONFIG = {
  // 基础配置
  IPV4: IPV4,
  PORT: PORT,
  PORT_MESSAGE: PORT_MESSAGE,
  BASE_URL: `http://${IPV4}:${PORT}/api`,
  MESSAGE_URL: `http://${IPV4}:${PORT_MESSAGE}/api`,

  WSURL : `ws://${IPV4}:${PORT_MESSAGE}/ws`,
  
  
  
  // 接口地址
  USER: {
    login: '/user/save',
    get_list_consumer:'/user/get_list_consumer',

    upload_merchant_url:'/user/upload_merchant_url',
    edit_merchant_nickname:'/user/edit_merchant_nickname',
    edit_merchant_gender:'/user/edit_merchant_gender',
    edit_merchant_region: '/user/edit_merchant_region',
  },
  YARD: {
    save: "/yard/save",
    get_openid_yard: "/yard/get_openid_yard",
    get_uuid_yard: "/yard/get_uuid_yard",

    save_pays: "/yard/save_pays",
    delete_pays: "/yard/delete_pays"
  },
  MESSAGE:{
    get_message:'/message/get_message',
    recalled_message:'/message/recalled_message',
    get_who_chat:'/message/get_who_chat',
    get_last_chat:'/message/get_last_chat',
    get_offline_chat:'/message/get_offline_chat'
  }
}

module.exports = API_CONFIG