// utils/avatar-utils.js

/**
 * 获取九宫格头像布局配置
 * @param {number} count 头像数量
 * @returns {Array} 头像位置配置
 */
function getAvatarLayout(count) {
  const layouts = {
    1: [{ x: 0.5, y: 0.5, size: 1 }],
    2: [
      { x: 0.25, y: 0.5, size: 0.5 },
      { x: 0.75, y: 0.5, size: 0.5 }
    ],
    3: [
      { x: 0.25, y: 0.33, size: 0.5 },
      { x: 0.75, y: 0.33, size: 0.5 },
      { x: 0.5, y: 0.67, size: 0.5 }
    ],
    4: [
      { x: 0.25, y: 0.25, size: 0.5 },
      { x: 0.75, y: 0.25, size: 0.5 },
      { x: 0.25, y: 0.75, size: 0.5 },
      { x: 0.75, y: 0.75, size: 0.5 }
    ],
    5: [
      { x: 0.25, y: 0.25, size: 0.5 },
      { x: 0.75, y: 0.25, size: 0.5 },
      { x: 0.25, y: 0.75, size: 0.5 },
      { x: 0.75, y: 0.75, size: 0.5 },
      { x: 0.5, y: 0.5, size: 0.5 }
    ],
    6: [
      { x: 0.25, y: 0.167, size: 0.5 },
      { x: 0.75, y: 0.167, size: 0.5 },
      { x: 0.25, y: 0.5, size: 0.5 },
      { x: 0.75, y: 0.5, size: 0.5 },
      { x: 0.25, y: 0.833, size: 0.5 },
      { x: 0.75, y: 0.833, size: 0.5 }
    ],
    7: [
      { x: 0.25, y: 0.167, size: 0.5 },
      { x: 0.75, y: 0.167, size: 0.5 },
      { x: 0.25, y: 0.5, size: 0.5 },
      { x: 0.75, y: 0.5, size: 0.5 },
      { x: 0.25, y: 0.833, size: 0.5 },
      { x: 0.75, y: 0.833, size: 0.5 },
      { x: 0.5, y: 0.5, size: 0.33 }
    ],
    8: [
      { x: 0.25, y: 0.167, size: 0.5 },
      { x: 0.75, y: 0.167, size: 0.5 },
      { x: 0.25, y: 0.5, size: 0.5 },
      { x: 0.75, y: 0.5, size: 0.5 },
      { x: 0.25, y: 0.833, size: 0.5 },
      { x: 0.75, y: 0.833, size: 0.5 },
      { x: 0.5, y: 0.33, size: 0.33 },
      { x: 0.5, y: 0.67, size: 0.33 }
    ],
    9: [
      { x: 0.166, y: 0.166, size: 0.33 },
      { x: 0.5, y: 0.166, size: 0.33 },
      { x: 0.834, y: 0.166, size: 0.33 },
      { x: 0.166, y: 0.5, size: 0.33 },
      { x: 0.5, y: 0.5, size: 0.33 },
      { x: 0.834, y: 0.5, size: 0.33 },
      { x: 0.166, y: 0.834, size: 0.33 },
      { x: 0.5, y: 0.834, size: 0.33 },
      { x: 0.834, y: 0.834, size: 0.33 }
    ]
  };
  return layouts[Math.min(count, 9)] || layouts[9];
}

/**
 * 绘制九宫格头像
 * @param {Object} ctx Canvas 上下文
 * @param {Array} avatarUrls 头像URL数组
 * @param {number} width 画布宽度
 * @param {number} height 画布高度
 * @returns {Promise}
 */
function drawNineGridAvatar(ctx, avatarUrls, width, height) {
  return new Promise((resolve, reject) => {
    if (!avatarUrls || avatarUrls.length === 0) {
      reject(new Error('头像列表为空'));
      return;
    }

    const count = Math.min(avatarUrls.length, 9);
    const layouts = getAvatarLayout(count);
    
    // 绘制背景（可选，设置圆角矩形背景）
    ctx.setFillStyle('#f0f0f0');
    ctx.fillRect(0, 0, width, height);
    
    let loadedCount = 0;
    const tempFilePaths = [];
    
    // 如果没有头像URL，使用默认头像
    const urls = avatarUrls.map(url => url || '/images/default-avatar.png');
    
    // 加载所有头像
    urls.slice(0, count).forEach((url, index) => {
      wx.getImageInfo({
        src: url,
        success: (res) => {
          tempFilePaths[index] = res.path;
          loadedCount++;
          
          if (loadedCount === count) {
            // 所有图片加载完成，开始绘制
            drawImages();
          }
        },
        fail: () => {
          // 加载失败使用默认头像
          wx.getImageInfo({
            src: '/images/default-avatar.png',
            success: (res) => {
              tempFilePaths[index] = res.path;
              loadedCount++;
              if (loadedCount === count) {
                drawImages();
              }
            },
            fail: () => {
              tempFilePaths[index] = null;
              loadedCount++;
              if (loadedCount === count) {
                drawImages();
              }
            }
          });
        }
      });
    });
    
    function drawImages() {
      // 清除画布
      ctx.clearRect(0, 0, width, height);
      
      // 绘制圆角矩形背景
      ctx.save();
      ctx.beginPath();
      ctx.setFillStyle('#e0e0e0');
      ctx.fillRect(0, 0, width, height);
      
      // 绘制每个头像
      layouts.forEach((layout, index) => {
        if (index >= tempFilePaths.length || !tempFilePaths[index]) return;
        
        const itemWidth = width * layout.size;
        const itemHeight = height * layout.size;
        const x = width * layout.x - itemWidth / 2;
        const y = height * layout.y - itemHeight / 2;
        
        // 绘制头像图片
        const img = tempFilePaths[index];
        if (img) {
          ctx.drawImage(img, x, y, itemWidth, itemHeight);
        }
        
        // 添加边框（可选）
        ctx.setStrokeStyle('#ffffff');
        ctx.setLineWidth(2);
        ctx.strokeRect(x, y, itemWidth, itemHeight);
      });
      
      ctx.restore();
      resolve();
    }
  });
}

/**
 * 生成群聊头像（使用Canvas生成）
 * @param {Array} avatarUrls 头像URL数组
 * @param {number} size 头像大小（像素）
 * @returns {Promise<string>} 临时文件路径
 */
function generateGroupAvatar(avatarUrls, size = 200) {
  return new Promise((resolve, reject) => {
    // 创建离屏Canvas
    const canvasId = `group_avatar_${Date.now()}_${Math.random()}`;
    
    // 创建Canvas实例
    const canvas = wx.createOffscreenCanvas({
      type: '2d',
      width: size,
      height: size
    });
    
    const ctx = canvas.getContext('2d');
    
    // 绘制九宫格
    drawNineGridAvatar(ctx, avatarUrls, size, size)
      .then(() => {
        // 导出为临时文件
        wx.canvasToTempFilePath({
          canvas: canvas,
          success: (res) => {
            resolve(res.tempFilePath);
          },
          fail: (err) => {
            console.error('导出图片失败:', err);
            reject(err);
          }
        });
      })
      .catch(reject);
  });
}

/**
 * 获取群聊头像显示URL
 * 如果已经生成了缓存头像，直接返回；否则生成新的
 * @param {string} groupUuid 群聊UUID
 * @param {Array} avatarUrls 成员头像URL数组
 * @returns {Promise<string>} 头像URL
 */
const avatarCache = new Map();

async function getGroupAvatarUrl(groupUuid, avatarUrls) {
  // 检查缓存
  if (avatarCache.has(groupUuid)) {
    const cached = avatarCache.get(groupUuid);
    // 检查缓存是否过期（可选，这里设置10分钟）
    if (Date.now() - cached.time < 10 * 60 * 1000) {
      return cached.url;
    }
  }
  
  try {
    // 生成新头像
    const tempPath = await generateGroupAvatar(avatarUrls, 200);
    // 缓存头像
    avatarCache.set(groupUuid, {
      url: tempPath,
      time: Date.now()
    });
    return tempPath;
  } catch (err) {
    console.error('生成群聊头像失败:', err);
    return '/images/group-default-avatar.png';
  }
}

module.exports = {
  getGroupAvatarUrl,
  generateGroupAvatar,
  drawNineGridAvatar
};