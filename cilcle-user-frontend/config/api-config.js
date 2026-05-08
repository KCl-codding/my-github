// const IPV4 = '192.168.43.253'
const IPV4 = '152.136.116.146'
const PORT = 8080
const PORT_MESSAGE = 8081

const DOMAIN = 'celibacy-plating-selection.ngrok-free.dev'

const API_CONFIG = {
  /*————————————————————————————————————————本地测试————————————————————————————————————————*/
  IPV4: IPV4,
  PORT: PORT,
  PORT_MESSAGE: PORT_MESSAGE,

  BASE_URL: `http://${IPV4}:${PORT}/api`,
  MESSAGE_URL: `http://${IPV4}:${PORT_MESSAGE}/api`,
  WSURL : `ws://${IPV4}:${PORT_MESSAGE}/ws`,
  /*————————————————————————————————————————————————————————————————————————————————————————*/
  DOMAIN: DOMAIN,

  // BASE_URL: `http://${DOMAIN}/api`,
  // MESSAGE_URL: `http://${DOMAIN}/api`,
  // WSURL : `wss://${DOMAIN}/ws`,
  
  // 接口地址
  USER: {
    login: '/user/save',

    get_random_consumer: '/user/get_random_consumer',
    get_one_consumer: '/user/get_one_consumer',
    get_one_merchant: '/user/get_one_merchant',
    get_list_consumer: '/user/get_list_consumer',
    get_all_consumer_openid:'/user/get_all_consumer_openid',
    get_join_url:'/user/get_join_url',
    get_consumer_url:'/user/get_consumer_url',

    upload_consumer_url:'/user/upload_consumer_url',
    
    edit_consumer_nickname:'/user/edit_consumer_nickname',
    edit_consumer_gender:'/user/edit_consumer_gender',
    edit_consumer_region: '/user/edit_consumer_region',
  },
  MESSAGE: {
    get_message: '/message/get_message',
    get_who_chat: '/message/get_who_chat',
    get_last_chat: '/message/get_last_chat',
    get_offline_chat:'/message/get_offline_chat',

    recalled_message: '/message/recalled_message',
  },
  YARD: {
    get_uuid_yard:'/yard/get_uuid_yard',

    get_four_type_yard: '/yard/get_four_type_yard',
    get_four_yard:'/yard/get_four_yard'
  },
  ACTIVITY:{
    get_all_activity:'/activity/get_all_activity',

    get_join:'/join/get_join',
    get_join_openid:'/join/get_join_openid',
  },
  GROUP:{
    get_openid_group:'/group/get_openid_group',
    get_one_group:'/group/get_one_group',
    get_last_group_message:'/group/get_last_group_message'
  }
}

module.exports = API_CONFIG