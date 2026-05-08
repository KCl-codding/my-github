/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_ONE_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_one_consumer;

Page({
  behaviors: [loginTipBehavior],

  data: {
    one_consumer: {}
  },

  onLoad(options) {
    if (!this.checkLogin()) {
      this.showLoginTip();
    }
    this.showLoading();
    this.getOneConsumer(options.openid);
    this.hideLoading();
  },
  goBack() {
    wx.navigateBack({
      delta: 1,
    })
  },
  sendMessage() {
    wx.navigateTo({
      url: '/pages/chat-ui/chat-ui',
      success:(res)=>{
            res.eventChannel.emit('sendData',{
              one_consumer:this.data.one_consumer
            });
      }
    })
  },
  getOneConsumer(openid) {
    wx.request({
      url: GET_ONE_CONSUMER,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        openid: openid
      },
      success: (res) => {
        this.setData({
          one_consumer: res.data.data
        });
        console.log(this.data.one_consumer);
      }
    })
  }
})
