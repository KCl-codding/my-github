/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js')

Page({
  behaviors: [loginTipBehavior],

  data: {
    yardList: []
  },

  onLoad() {
    // 先检查登录状态
    const userInfo = this.getUserInfo()
    if (!userInfo || !userInfo.openId) {
      console.log('未登录，显示登录弹窗')
      this.showLoginTip()
    } else {
      console.log('已登录，openid:', userInfo.openId)
    }
  },

  /**
   * 当用户通过登录弹窗登录成功后，会调用此方法
   */
  onLoginSuccess() {
    console.log('登录成功，重新获取数据')
    const userInfo = this.getUserInfo()
    if (userInfo && userInfo.openId) {
      this.getYardList(userInfo.openId)
    }
  },

});