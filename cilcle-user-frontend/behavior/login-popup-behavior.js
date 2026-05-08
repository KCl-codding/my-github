const API_CONFIG = require('../config/api-config.js')
const API_LOGIN = API_CONFIG.BASE_URL + API_CONFIG.USER.login

module.exports = Behavior({
  data: {
    /*————————————————————控制弹窗————————————————————*/
    loadingVisible: false,
    showLoginTip: false,
    // 记录登录提示弹窗是否应该自动显示
    shouldShowLoginTip: true,
    /*————————————————————登录请求————————————————————*/
    loginDto: {}
  },

  // 生命周期钩子会被合并到页面中
  lifetimes: {
    attached() {
      // 组件生命周期，如果是组件使用此钩子
    }
  },

  pageLifetimes: {
    // 页面显示时
    show() {
      // 如果标记为不应该显示登录提示，则保持关闭状态
      if (!this.data.shouldShowLoginTip && this.data.showLoginTip) {
        this.setData({
          showLoginTip: false
        });
      }
    },

    // 页面隐藏时（切换tabBar时会触发）
    hide() {
      // 关闭登录提示弹窗，并标记下次显示时不要重新弹出
      if (this.data.showLoginTip) {
        this.setData({
          showLoginTip: false,
          shouldShowLoginTip: false
        });
      }
    }
  },

  methods: {
    /*————————————————————loading————————————————————*/
    showLoading() {
      this.setData({ loadingVisible: true });
    },
    hideLoading() {
      this.setData({ loadingVisible: false });
    },
    onLoadingClose() {
      this.hideLoading();
    },

    /*————————————————————提示登录弹窗————————————————————*/
    showLoginTip() {
      this.setData({ showLoginTip: true });
    },
    hideLoginTip() {
      this.setData({ showLoginTip: false });
    },
    onTipClose() {
      this.setData({
        showLoginTip: false,
        pendingAction: null,
        shouldShowLoginTip: false
      });
    },
    onTipCancel() {
      this.setData({
        showLoginTip: false,
        pendingAction: null,
        shouldShowLoginTip: false
      });
    },
    onGoLogin() {
      this.setData({
        showLoginTip: false,
        shouldShowLoginTip: false,
      });

      this.showLoading();
      console.log('========== 开始准备登录数据 ==========');

      wx.login({
        success: (loginRes) => {
          const code = loginRes.code;

          wx.getUserInfo({
            success: (userRes) => {
              const userInfo = userRes.userInfo;

              this.setData({
                loginDto: {
                  code: code,
                  iv: userRes.iv,
                  encryptedData: userRes.encryptedData,
                  type: 0
                }
              });

              console.log('登录参数:', this.data.loginDto);

              // 调用后端登录接口
              this.loginToBackend(this.data.loginDto);
            },
            fail: (err) => {
              console.error('获取用户信息失败:', err);
              this.hideLoading();
              wx.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              });
              // 即使获取用户信息失败，也尝试登录（有些小程序允许无用户信息）
              this.setData({
                loginDto: {
                  code: code,
                  iv: '',
                  encryptedData: ''
                }
              });
              this.loginToBackend(this.data.loginDto);
            }
          });
        },
        fail: (err) => {
          console.error('获取登录凭证失败:', err);
          this.hideLoading();
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
          if (this.onLoginFail) {
            this.onLoginFail(err);
          }
        }
      });
    },
    /*————————————————————————登录————————————————————————*/
    loginToBackend(loginDto) {
      wx.request({
        url: API_LOGIN,
        method: "POST",
        data: loginDto,
        success: (res) => {
          console.log('登录响应:', res);

          if (res.statusCode === 200 && res.data) {
            const token = res.data.data.token;
            const userInfo = res.data.data.userInfo;

            wx.setStorageSync('token', token);
            wx.setStorageSync('userInfo', userInfo)

            // 存储过期时间（
            const expireTime = Date.now() + 2592000000;
            wx.setStorageSync('tokenExpireTime', expireTime);

            const app = getApp();
            if (app && app.setupWebSocketAfterLogin) {
              app.setupWebSocketAfterLogin(userInfo.openId, token);
            }
            // 登录成功后的回调
            if (this.onLoginSuccess) {
              this.onLoginSuccess(res.data);
            }
          } else {
            console.error('登录失败:', res);
            wx.showToast({
              title: '登录失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('请求登录接口失败:', err);
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
        },
        complete: () => {
          this.hideLoading();
        }
      });
    },

    // 检查登录状态
    checkLogin() {
      const token = wx.getStorageSync('token');
      const expireTime = wx.getStorageSync('tokenExpireTime');

      if (!token || !expireTime) {
        return false;
      }

      // 检查是否过期
      if (Date.now() > expireTime) {
        // Token过期，清除
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo')
        wx.removeStorageSync('tokenExpireTime');
        return false;
      }
      return true;
    },

    getUserInfo() {
      return wx.getStorageSync("userInfo");
    },
    getToken() {
      return wx.getStorageSync('token');
    },

    // 清除登录状态（登出）
    logout() {
      // 清除本地存储
      wx.removeStorageSync('token');
      wx.removeStorageSync('tokenExpireTime');
      wx.removeStorageSync('userInfo');

      // 调用 app 的 logout 关闭 WebSocket 和清除全局数据
      const app = getApp();
      if (app && app.logout) {
        app.logout();
      } else {
        // 兜底：至少关闭 WebSocket 连接
        try {
          wx.closeSocket();
        } catch (e) { }
      }
    }
  }
});