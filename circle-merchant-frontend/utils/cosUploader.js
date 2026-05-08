const COS = require('./cos-wx-sdk-v5.js')

/**
 * 上传图片到腾讯云COS
 * @param {Object} params 上传参数
 * @param {string} params.filePath - 本地图片路径
 * @param {Function} params.onProgress - 进度回调 (progress) => {}
 * @param {Function} params.onSuccess - 成功回调 (imageUrl) => {}
 * @param {Function} params.onFail - 失败回调 (error) => {}
 * @param {string} params.stsUrl - 获取临时密钥的接口地址（可选）
 */
function uploadImageToCOS(params) {
  const {
    filePath,
    uploadType = 'image',  // 新增：接收上传类型
    onProgress,
    onSuccess,
    onFail,
    stsUrl = 'http://152.136.116.146:8080/api/cos/sts'
  } = params

  // 1. 获取临时密钥
  wx.request({
    url: stsUrl,
    method: 'GET',
    success: (res) => {
      console.log('STS响应:', res.data)
      
      if (res.data.code === 200) {
        const stsData = res.data.data
        // 2. 执行上传到COS - 这里要传递 uploadType
        uploadToCos(filePath, stsData, uploadType, onProgress, onSuccess, onFail)
      } else {
        onFail && onFail(new Error(res.data.message || '获取凭证失败'))
      }
    },
    fail: (err) => {
      console.error('请求STS失败:', err)
      onFail && onFail(new Error('网络错误'))
    }
  })
}

// 修改这个函数，添加 uploadType 参数
function uploadToCos(filePath, stsData, uploadType, onProgress, onSuccess, onFail) {
  const cos = new COS({
    getAuthorization: (options, callback) => {
      callback({
        TmpSecretId: stsData.tmpSecretId,
        TmpSecretKey: stsData.tmpSecretKey,
        SecurityToken: stsData.sessionToken,
        StartTime: stsData.startTime,
        ExpiredTime: stsData.expiredTime
      })
    }
  })
  
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const ext = filePath.split('.').pop()
  // 使用动态的 uploadType
  const key = `${uploadType}/${timestamp}_${random}.${ext}`
  
  wx.getFileSystemManager().readFile({
    filePath: filePath,
    success: (fileData) => {
      cos.putObject({
        Bucket: 'kcl-data-1421104858',
        Region: 'ap-guangzhou',
        Key: key,
        Body: fileData.data,
        onProgress: (progressData) => {
          const percent = Math.round(progressData.percent * 100)
          onProgress && onProgress(percent)
        }
      }, (err, data) => {
        if (err) {
          onFail && onFail(err)
        } else {
          const imageUrl = `https://${data.Location}`
          onSuccess && onSuccess(imageUrl)
        }
      })
    },
    fail: (err) => {
      onFail && onFail(new Error('读取文件失败'))
    }
  })
}

module.exports = {
  uploadImageToCOS
}