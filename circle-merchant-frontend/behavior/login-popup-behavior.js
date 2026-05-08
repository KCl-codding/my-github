const API_CONFIG = require('../config/api-config.js')
const API_LOGIN = API_CONFIG.BASE_URL + API_CONFIG.USER.login

module.exports = Behavior({
  data: {
    loadingVisible: false,
    showLoginTip: false,
    shouldShowLoginTip: true,
    loginDto: {}
  },

  lifetimes: {
    attached() {}
  },

  pageLifetimes: {
    show() {
      if (!this.data.shouldShowLoginTip && this.data.showLoginTip) {
        this.setData({ showLoginTip: false });
      }
    },
    hide() {
      if (this.data.showLoginTip) {
        this.setData({
          showLoginTip: false,
          shouldShowLoginTip: false
        });
      }
    }
  },

  methods: {
    showLoading() {
      this.setData({ loadingVisible: true });
    },
    hideLoading() {
      this.setData({ loadingVisible: false });
    },
    onLoadingClose() {
      this.hideLoading();
    },

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
      wx.showToast({
        title: '登录后可继续操作',
        icon: 'none'
      });
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
              this.setData({
                loginDto: {
                  code: code,
                  iv: userRes.iv,
                  encryptedData: userRes.encryptedData,
                  type: 1
                }
              });
              console.log('登录参数:', this.data.loginDto);
              this.loginToBackend(this.data.loginDto);
            },
            fail: (err) => {
              console.error('获取用户信息失败:', err);
              this.hideLoading();
              wx.showToast({
                title: '获取用户信息失败',
                icon: 'none'
              });
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

            // ✅ 修改：使用 getStorageKey
            const app = getApp();
            wx.setStorageSync(app.getStorageKey('token'), token);
            wx.setStorageSync(app.getStorageKey('userInfo'), userInfo);
            console.log("userInfo 已存储");

            const expireTime = Date.now() + 2592000000;
            wx.setStorageSync(app.getStorageKey('tokenExpireTime'), expireTime);

            if (app && app.setupWebSocketAfterLogin) {
              app.setupWebSocketAfterLogin(userInfo.openId, token);
            }

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

    // ✅ 检查登录状态
    checkLogin() {
      const app = getApp();
      const token = wx.getStorageSync(app.getStorageKey('token'));
      const expireTime = wx.getStorageSync(app.getStorageKey('tokenExpireTime'));

      if (!token || !expireTime) {
        return false;
      }

      if (Date.now() > expireTime) {
        wx.removeStorageSync(app.getStorageKey('token'));
        wx.removeStorageSync(app.getStorageKey('userInfo'));
        wx.removeStorageSync(app.getStorageKey('tokenExpireTime'));
        return false;
      }
      return true;
    },

    // ✅ 获取用户信息
    getUserInfo() {
      const app = getApp();
      return wx.getStorageSync(app.getStorageKey('userInfo'));
    },

    // ✅ 获取 token
    getToken() {
      const app = getApp();
      return wx.getStorageSync(app.getStorageKey('token'));
    },

    // ✅ 登出
    logout() {
      const app = getApp();
      wx.removeStorageSync(app.getStorageKey('token'));
      wx.removeStorageSync(app.getStorageKey('tokenExpireTime'));
      wx.removeStorageSync(app.getStorageKey('userInfo'));
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      });
    }
  }
});