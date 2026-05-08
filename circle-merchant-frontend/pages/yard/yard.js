/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js')
const API_GET_OPENID_YARD = API_CONFIG.BASE_URL + API_CONFIG.YARD.get_openid_yard

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
      this.getYardList(userInfo.openId)
    }
  },

  onShow(){
    const userInfo = this.getUserInfo();
    this.getYardList(userInfo.openId);
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

  /**
   * 生成连接线（根据项目名称长度动态生成）
   */
  getConnectLine(projectName) {
    if (!projectName) return '.......'
    let nameLength = 0
    for (let i = 0; i < projectName.length; i++) {
      const char = projectName.charAt(i)
      if (/[\u4e00-\u9fa5]/.test(char)) {
        nameLength += 2
      } else {
        nameLength += 1
      }
    }
    let lineLength = 32 - nameLength
    lineLength = Math.max(8, Math.min(45, lineLength))
    return '．'.repeat(lineLength)
  },

  /**
   * 计算单个活动的总金额
   */
  calculateTotalMoney(pays) {
    if (!pays || pays.length === 0) return '0.00'
    let total = 0
    pays.forEach(item => {
      const moneyNum = Number(item.money)
      if (!isNaN(moneyNum)) {
        total += moneyNum
      }
    })
    return total.toFixed(2)
  },

  /**
   * 查看详情
   */
  viewDetail(e) {
    const uuid = e.currentTarget.dataset.uuid
    wx.navigateTo({
      url: `/pages/detail/detail?uuid=${uuid}`
    })
  },

  /**
   * 获取活动列表
   */
  getYardList(openid) {
    // 检查 openid 是否有效
    if (!openid) {
      console.error('openid 为空，无法获取数据')
      return
    }

    console.log('开始请求数据，openid:', openid)
    
    // 显示加载中（如果有 loading 组件）
    this.setData({ loadingVisible: true })

    wx.request({
      url: API_GET_OPENID_YARD,
      method: "POST",
      data: {
        openid: openid
      },
      header: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      success: (res) => {
        console.log('接口返回数据:', res.data)
        
        // 隐藏加载中
        this.setData({ loadingVisible: false })
        
        // 检查返回数据是否成功
        if (res.data && res.data.code === 200) {
          let yardList = res.data.data || []
          
          // 处理数据：为每个支付项添加 connectLine，并预计算总金额
          const processedList = yardList.map(item => {
            // 处理 pays 数组，添加 connectLine 字段
            let processedPays = []
            if (item.pays && item.pays.length > 0) {
              processedPays = item.pays.map(pay => {
                return {
                  ...pay,
                  connectLine: this.getConnectLine(pay.payProject)
                }
              })
            }
            
            // 预计算总金额
            const totalMoney = this.calculateTotalMoney(processedPays)
            
            console.log(`活动 ${item.activity} 总金额:`, totalMoney)
            
            return {
              ...item,
              pays: processedPays,
              type: item.type || '未分类',
              totalMoney: totalMoney
            }
          })
          
          console.log('处理后的列表:', processedList)
          
          this.setData({
            yardList: processedList
          }, () => {
            console.log('数据设置完成，共', this.data.yardList.length, '条数据')
          })
        } else {
          console.error('接口返回错误:', res.data)
          // 如果返回空数据，清空列表
          this.setData({ yardList: [] })
        }
      },
      fail: (err) => {
        console.error('请求失败:', err)
        this.setData({ loadingVisible: false })
        // 显示错误提示
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  
  onUploadRequest() {
    if(!this.checkLogin()){
      this.showLoginTip();
      return;
    }
    wx.navigateTo({
      url: '/pages/add/add',
    });
  },
});